import { existsSync, readdirSync, readFileSync, realpathSync } from 'fs';
import { join } from 'path';
import { once } from 'events';
import { readGraphText } from './graph/io';
import { resolveUserPath } from './workspace/paths';
import { resolveWorkspace } from './workspace/resolver';
import { portableWorkspacePath } from './workspace/graph';
import { shortestGraphPath } from './graph/path';
import { toolOutputSchema } from './graph/contracts';
import { normalizeGraph, graphNeighborhood, type NormalizedGraph } from './graph/model';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const modern = '2026-07-28';
const serverMeta = { 'io.modelcontextprotocol/serverInfo': { name: 'dotdog', version: pkg.version } };
const versions = ['2025-11-25', '2025-06-18', '2024-11-05'];
const string = { type: 'string' };
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const graphArgs = { project: string };
const definitions = [
  ['getEntity', 'Entity properties, schema, lifecycle, provenance and outgoing relationships', { ...graphArgs, name: string }, ['name']],
  ['traverse', 'Bounded outgoing neighborhood, preserving relationship evidence', { ...graphArgs, from: string, depth: integer(0, 12), limit: integer(1, 1000), verb: string }, ['from']],
  ['path', 'Shortest connecting subgraph with relationship evidence', { ...graphArgs, from: string, to: string, direction: { enum: ['any', 'incoming', 'outgoing'] }, maxHops: integer(1, 12), verb: string }, ['from', 'to']],
  ['search', 'Find entities by name; cursor paginates large result sets', { ...graphArgs, q: string, type: string, limit: integer(1, 1000), cursor: string }, ['q']],
  ['listProjects', 'List available project graphs', {}, []],
  ['workspace.list', 'Repository-relative workspace metadata, not instructions', {}, []],
  ['summary', 'Graph counts, coverage, limitations and estimated savings', graphArgs, []],
  ['schema', 'Full property definitions from the compiled graph', { ...graphArgs, entity: string }, ['entity']],
  ['context', 'Task-relevant nodes with bounded connected context', { ...graphArgs, q: string, depth: integer(0, 12), limit: integer(1, 1000) }, ['q']],
  ['impact', 'Reverse dependency neighborhood for a proposed change; not a runtime proof', { ...graphArgs, from: string, depth: integer(0, 12), limit: integer(1, 1000) }, ['from']],
  ['infraVerify', 'Explicit live, read-only infrastructure verification; may contact configured providers', { provider: string, entity: string, summary: { type: 'boolean' } }, []],
] as const;

function success(id: any, data: any, textData = data) {
  const structuredContent = Array.isArray(data) ? { items: data } : data;
  return { jsonrpc: '2.0', id, result: { resultType: 'complete', _meta: serverMeta, isError: false, structuredContent, content: [{ type: 'text', text: JSON.stringify(textData) }] } };
}

function failure(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function createMcpHandler(dir: string) {
  const root = realpathSync(dir);
  let fingerprint = '';
  let graphs = new Map<string, { graph: NormalizedGraph; raw: any }>();
  let invalidProjects: Record<string, string> = Object.create(null);
  function load() {
    const candidates = new Map<string, string>();
    const compiled = join(root, '.doghouse/compiled/repo.dag');
    if (existsSync(compiled)) candidates.set(resolveUserPath(compiled, root), 'repo');
    for (const directory of [join(root, 'projects'), join(root, 'specs'), join(root, '.doghouse/imported'), root]) {
      if (!existsSync(directory)) continue;
      resolveUserPath(directory, root);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          const file = join(directory, entry.name, entry.name + '.dag');
          if (existsSync(file)) candidates.set(resolveUserPath(file, root), entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.dag')) {
          const key = entry.name.slice(0, -4);
          candidates.set(resolveUserPath(join(directory, entry.name), root), key);
        }
      }
    }
    const sources: string[][] = [];
    let bytes = 0;
    for (const [file, key] of candidates) {
      const source = readGraphText(file);
      bytes += Buffer.byteLength(source);
      if (bytes > 128 * 1024 * 1024) throw new Error('Combined project graphs exceed 128 MiB');
      sources.push([key, file, source]);
    }
    const next = JSON.stringify(sources);
    if (next === fingerprint) return;
    const loaded = new Map<string, { graph: NormalizedGraph; raw: any }>();
    invalidProjects = Object.create(null);
    for (const [key, file, source] of sources) {
      try {
        const raw = JSON.parse(source), graph = normalizeGraph(raw);
        if (file === compiled) graph.project = (graph.project || 'repository') + ':observed';
        const name = graph.project || key;
        if (loaded.has(name) || invalidProjects[name]) { loaded.delete(name); invalidProjects[name] = 'Duplicate project name'; continue; }
        loaded.set(name, { graph, raw });
      } catch (error) { invalidProjects[key] = error instanceof Error ? error.message : String(error); }
    }
    graphs = loaded;
    fingerprint = next;
  }

  return async (req: any): Promise<any> => {
    if (!req || typeof req !== 'object' || Array.isArray(req) || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return failure(req?.id, -32600, 'Invalid Request');
    if (!Object.prototype.hasOwnProperty.call(req, 'id')) return undefined;
    const { id, method } = req;
    if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isFinite(id))) return failure(null, -32600, 'Invalid request id');
    const meta = req.params?._meta;
    if (meta !== undefined) {
      const version = meta?.['io.modelcontextprotocol/protocolVersion'];
      if (version !== modern) return { jsonrpc: '2.0', id, error: { code: -32022, message: 'Unsupported protocol version', data: { supported: [modern], requested: version } } };
      const capabilities = meta['io.modelcontextprotocol/clientCapabilities'];
      if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return failure(id, -32602, 'clientCapabilities must be an object');
    }
    try {
      if (method === 'server/discover') return { jsonrpc: '2.0', id, result: { resultType: 'complete', _meta: serverMeta, supportedVersions: [modern, ...versions], capabilities: { tools: {} }, ttlMs: 0, cacheScope: 'private' } };
      if (method === 'initialize') {
        const requested = req.params?.protocolVersion;
        return { jsonrpc: '2.0', id, result: { protocolVersion: versions.includes(requested) ? requested : versions[0], serverInfo: { name: 'dotdog', version: pkg.version }, capabilities: { tools: {} } } };
      }
      if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
      if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { resultType: 'complete', _meta: serverMeta, tools: definitions.map(([name, description, properties, required]) => ({
        name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false },
        outputSchema: toolOutputSchema(name),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: name === 'infraVerify' },
      })).sort((a, b) => a.name.localeCompare(b.name)) } };
      if (method !== 'tools/call') return failure(id, -32601, 'Method not found: ' + method);
      const params = req.params;
      const definition = definitions.find(item => item[0] === params?.name);
      if (!definition) return failure(id, -32602, 'Unknown tool');
      const args = params.arguments ?? {};
      if (!args || typeof args !== 'object' || Array.isArray(args)) return failure(id, -32602, 'arguments must be an object');
      const properties: any = definition[2];
      for (const key of definition[3]) if (!(key in args)) return failure(id, -32602, 'Missing argument: ' + key);
      for (const [key, value] of Object.entries(args)) {
        const schema = Object.hasOwn(properties, key) ? properties[key] : undefined;
        if (!schema) return failure(id, -32602, 'Unknown argument: ' + key);
        if (schema.enum ? !schema.enum.includes(value) : schema.type === 'integer' ? !Number.isInteger(value) || Number(value) < schema.minimum || Number(value) > schema.maximum : typeof value !== schema.type) return failure(id, -32602, 'Invalid argument: ' + key);
      }
      load();
      const name = params.name;
      if (name === 'listProjects') return success(id, { items: [...graphs.keys()].sort(), invalidProjects }, [...graphs.keys()].sort());
      if (name === 'workspace.list') {
        const workspace = resolveWorkspace(root, { requireManifest: false });
        const repos = workspace.repos.map(repo => { const path = portableWorkspacePath(workspace, repo.cwd); return { alias: repo.alias, role: repo.role, path, cwd: path }; });
        return success(id, { workspace: workspace.config.workspace, mode: workspace.mode, repos, groups: workspace.config.groups || [], trustedAsInstruction: false, contentKind: 'workspace-metadata' });
      }
      if (name === 'infraVerify') {
        const { verifyInfra } = await import('./infra/verify');
        const results = await verifyInfra({ dir: root, providerFilter: args.provider, entityFilter: args.entity });
        return success(id, args.summary ? { total: results.length, results } : results);
      }
      if (!args.project && graphs.size > 1) return failure(id, -32602, 'Multiple projects available; specify project');
      const entry = graphs.get(args.project || [...graphs.keys()][0]);
      if (!entry) { const result = success(id, { error: invalidProjects[args.project] || 'project_not_found' }); result.result.isError = true; return result; }
      const { graph, raw } = entry;
      const byId = new Map(graph.nodes.map(node => [node.id, node]));
      const find = (query: string) => {
        const exact = graph.nodes.find(node => node.id === query);
        if (exact) return exact;
        const matches = graph.nodes.filter(node => node.label.toLowerCase() === query.toLowerCase() || node.id.toLowerCase() === query.toLowerCase());
        if (matches.length > 1) throw new Error('Ambiguous entity; query an exact ID: ' + matches.slice(0, 100).map(node => node.id).join(', '));
        return matches[0];
      };
      if (name === 'getEntity' || name === 'schema') {
        const node = find(args.name || args.entity);
        if (!node) return success(id, { error: 'entity_not_found' });
        const properties = Object.keys(node.schema).length ? Object.fromEntries(Object.entries(node.schema).map(([key, value]) => [key, `${(value as any).type?.[0] || 's'}${(value as any).required ? '!' : ''}`])) : node.properties;
        if (name === 'schema') return success(id, { entity: node.label, properties, schema: node.schema });
        return success(id, { name: node.label, type: node.kind, properties, schema: node.schema, states: node.states, lifecycle: node.lifecycle, description: node.description,
          origin: node.origin, confidence: node.confidence, evidence: node.evidence,
          edges: graph.edges.filter(edge => edge.sourceId === node.id).map(edge => [byId.get(edge.targetId)!.label, edge.verb, edge.cardinality || '']) });
      }
      if (name === 'summary') {
        const tk = Array.isArray(raw) ? raw[3] : raw.tk || raw.tokens || {};
        return success(id, { project: graph.project, nodes: graph.nodes.length, edges: graph.edges.length, savings: tk.sv || 0, savingsMethod: 'bytes/4 estimate', coverage: graph.coverage, limitations: graph.limitations });
      }
      if (name === 'search') {
        const offset = args.cursor === undefined ? 0 : Number(args.cursor);
        if (!Number.isSafeInteger(offset) || offset < 0) return failure(id, -32602, 'Invalid cursor');
        const matches = graph.nodes.filter(node => node.label.toLowerCase().includes(args.q.toLowerCase()) && (!args.type || node.kind.toLowerCase().includes(args.type.toLowerCase())));
        const limit = args.limit || 100;
        const items = matches.slice(offset, offset + limit).map(node => [node.kind, node.label]);
        return success(id, { items, total: matches.length, nextCursor: offset + limit < matches.length ? String(offset + limit) : null }, items);
      }
      if (name === 'path') return success(id, shortestGraphPath(raw, args.from, args.to, { direction: args.direction, maxHops: args.maxHops, verb: args.verb }));
      if (name === 'context') {
        const idMatches = graph.nodes.filter(node => node.id === args.q);
        const exact = idMatches.length ? idMatches : graph.nodes.filter(node => node.label === args.q);
        const matches = exact.length ? exact : graph.nodes.filter(node => `${node.label} ${node.description || ''}`.toLowerCase().includes(args.q.toLowerCase()));
        if (matches.length !== 1) return success(id, { ok: false, error: matches.length ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: matches.slice(0, args.limit || 100).map(node => node.label) });
        return success(id, graphNeighborhood(graph, matches[0].id, { depth: args.depth, limit: args.limit }));
      }
      const neighborhood = graphNeighborhood(graph, args.from, { direction: name === 'impact' ? 'incoming' : 'outgoing', depth: args.depth, limit: args.limit, verb: args.verb });
      if (name === 'impact') return success(id, neighborhood);
      return success(id, { ...neighborhood, nodes: neighborhood.nodes.map(node => ({ name: node.label, edges: neighborhood.edges.filter(edge => edge.sourceId === node.id).map(edge => `${byId.get(edge.targetId)!.label}:${edge.verb}${edge.cardinality ? '(' + edge.cardinality + ')' : ''}`) })) });
    } catch (error) {
      return { jsonrpc: '2.0', id, result: { resultType: 'complete', _meta: serverMeta, isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] } };
    }
  };
}

export async function serve(dir = '.') {
  const handle = createMcpHandler(dir);
  const write = async (response: any) => {
    if (response !== undefined && !process.stdout.write(JSON.stringify(response) + '\n')) await once(process.stdout, 'drain');
  };
  process.stdin.setEncoding('utf8');
  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (Buffer.byteLength(line) > 1024 * 1024) { await write(failure(null, -32600, 'Request exceeds 1 MiB')); return; }
      let request;
      try { request = JSON.parse(line); }
      catch { await write(failure(null, -32700, 'Parse error')); continue; }
      await write(await handle(request));
    }
    if (Buffer.byteLength(buffer) > 1024 * 1024) { await write(failure(null, -32600, 'Request exceeds 1 MiB')); return; }
  }
  if (buffer.trim()) await write(failure(null, -32700, 'Unterminated JSON-RPC line'));
}
