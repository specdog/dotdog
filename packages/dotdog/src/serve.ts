// spec serve — MCP server over stdio
// Exposes .dag graph to AI agents (supports v3, v2 positional, v1.5, v1.4, v1.3)

import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

function resolvePath(p: string): string {
  if (p.startsWith('~')) p = join(homedir(), p.slice(1));
  const resolved = p.startsWith('/') ? p : join(process.cwd(), p);
  if (!p.startsWith('/') && !p.startsWith('~')) {
    const rel = resolve(process.cwd(), p);
    const cwd = process.cwd();
    const isDescendant = rel.startsWith(cwd + '/');
    const isSelf = rel === cwd;
    const isAncestor = cwd.startsWith(rel + '/');
    if (!isDescendant && !isSelf && !isAncestor) {
      throw new Error(`Path traversal blocked: ${p}`);
    }
    return rel;
  }
  return resolved;
}

// v2 format detector: positional arrays where first element is a number
const isV2 = (n: any) => Array.isArray(n) && typeof n[0] === 'number';
const N = (dag: any) => dag.n || dag.nodes || [];

// Convert v2 positional edge to v1-compatible object
function edgeToObj(n: any, tgtIdx: number, v2e: any[]): any {
  return { t: String(tgtIdx), v: v2e[1] || '', c: v2e[2] || '', r: v2e[3] || 0 };
}
function nodeEdges(n: any): any[] {
  if (isV2(n)) return (n[6] || []).map((e: any[]) => edgeToObj(n, e[0], e));
  return n.es || [];
}
function E(dag: any): any[] {
  if (dag.e) return dag.e;
  const edges: any[] = [];
  const seen = new Set<string>();
  for (const node of N(dag)) {
    for (const e of nodeEdges(node)) {
      const src = nodeId(node);
      const key = `${src}→${e.t}:${e.v}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ s: src, t: e.t, v: e.v, d: e.d, c: e.c, r: e.r });
      }
    }
  }
  return edges;
}
const P = (dag: any) => dag.p || dag.project || '';
const nodeId = (n: any) => isV2(n) ? String(n[0]) : (n.i || n.id || '');
const nodeName = (n: any) => isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || n.name || '');
function nodeMatches(n: any, value: string): boolean {
  const q = (value || '').toLowerCase();
  return nodeId(n).toLowerCase() === q || nodeName(n).toLowerCase() === q;
}
const nt = (n: any) => isV2(n) ? (n[2] || '') : (n.t || n.type || '');
const nd = (n: any) => isV2(n) ? (n[3] || '') : (n.d || n.description || '');
function np(n: any): any {
  if (isV2(n)) {
    const flat = n[4] || [];
    const obj: Record<string,string> = {};
    for (let i = 0; i < flat.length; i += 2) obj[flat[i]] = flat[i+1] || '';
    return obj;
  }
  return n.p || n.properties || {};
}
const ns = (n: any) => isV2(n) ? (n[5] || []) : (n.s || n.states || []);
const nl = (n: any) => isV2(n) ? [] : (n.l || n.lifecycle || []);
const es = (e: any) => e.s || e.source || '';
const et = (e: any) => e.t || e.target || '';

export function serve(dir: string = '.'): void {
  const root = resolvePath(dir);
  const dagCache: Map<string, any> = new Map();

  // Find and load .dag files
  function loadDags(): string[] {
    const dirs = [join(root,'projects'),join(root,'specs'),root];
    for (const dd of dirs) {
      if (!existsSync(dd)) continue;
      const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
      for (const p of projects) {
        const dagFile = join(dd,p,`${p}.dag`);
        if (existsSync(dagFile)) {
          dagCache.set(p, JSON.parse(readFileSync(dagFile,'utf-8')));
        }
      }
    }
    return [...dagCache.keys()];
  }

  // MCP JSON-RPC handler
  async function handleRequest(req: any): Promise<any> {
    const { id, method, params } = req;

    // Initialize
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'spec-serve', version: '0.1.0' },
          capabilities: { tools: {} }
        }
      };
    }

    // List tools
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0', id,
        result: {
          tools: [
            { name: 'getEntity', description: 'Get entity with properties, states, lifecycle', inputSchema: { type: 'object', properties: { project: { type:'string' }, name: { type:'string' } }, required: ['name'] } },
            { name: 'traverse', description: 'Traverse graph: from node, follow edges, return subgraph', inputSchema: { type: 'object', properties: { project: { type:'string' }, from: { type:'string' }, depth: { type:'number', default: 1 } }, required: ['from'] } },
            { name: 'search', description: 'Find entities by name or type', inputSchema: { type: 'object', properties: { project: { type:'string' }, q: { type:'string' }, type: { type:'string' } }, required: ['q'] } },
            { name: 'listProjects', description: 'List all projects', inputSchema: { type: 'object', properties: {} } },
            { name: 'summary', description: 'Get project summary: node count, edge count, token savings', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
            { name: 'schema', description: 'Get full property schema for an entity', inputSchema: { type: 'object', properties: { project: { type:'string' }, entity: { type:'string' } }, required: ['entity'] } },
            { name: 'listBlogs', description: 'List all blog posts with titles and descriptions', inputSchema: { type: 'object', properties: {} } },
            { name: 'infraVerify', description: 'Verify infrastructure resources defined in .dog specs against live cloud (Cloudflare, Supabase, Vercel, Netlify, Railway, AWS)', inputSchema: { type: 'object', properties: { provider: { type: 'string', description: 'Filter by provider (cloudflare, supabase, vercel, netlify, railway, aws)' }, entity: { type: 'string', description: 'Filter by spec entity name' } } } },
          ]
        }
      };
    }

    // Call tool
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      loadDags();

      if (name === 'listProjects') {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify([...dagCache.keys()]) }] } };
      }

      if (name === 'listNodes') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(N(dag)) }] } };
      }

      if (name === 'getEntity') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = N(dag).find((n: any) => nodeMatches(n, args.name || ''));
        if (!node) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{}' }] } };
        const idForEdges = nodeId(node);
        const edges = E(dag).filter((e: any) =>
          es(e).toLowerCase() === idForEdges.toLowerCase() ||
          et(e).toLowerCase() === idForEdges.toLowerCase()
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(isV2(node) ? { id: nodeId(node), name: nodeName(node), type: nt(node), description: nd(node), properties: np(node), states: ns(node), edges } : { ...node, edges }) }] } };
      }

      if (name === 'traverse') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const depth = Math.min(Math.max(1, args.depth || 1), 20);
        const visitedNodes = new Set<string>();
        const visitedEdges = new Set<string>();
        const subgraph: { nodes: any[], edges: any[] } = { nodes: [], edges: [] };
        const start = N(dag).find((n: any) => nodeMatches(n, args.from || ''));
        const queue = [{ id: start ? nodeId(start) : args.from, depth: 0 }];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          const node = N(dag).find((n: any) => nodeMatches(n, curr.id));
          const currId = node ? nodeId(node) : curr.id;
          if (visitedNodes.has(currId) || curr.depth > depth) continue;
          visitedNodes.add(currId);
          if (node) subgraph.nodes.push(isV2(node) ? { id: nodeId(node), name: nodeName(node), type: nt(node), description: nd(node), properties: np(node), states: ns(node), edges: nodeEdges(node) } : node);
          const edges = E(dag).filter((e: any) =>
            es(e).toLowerCase() === currId.toLowerCase() || et(e).toLowerCase() === currId.toLowerCase()
          );
          for (const e of edges) {
            const edgeKey = `${es(e)}→${et(e)}`;
            if (!visitedEdges.has(edgeKey)) {
              visitedEdges.add(edgeKey);
              subgraph.edges.push(e);
            }
            const next = es(e).toLowerCase() === currId.toLowerCase() ? et(e) : es(e);
            if (!visitedNodes.has(next)) queue.push({ id: next, depth: curr.depth + 1 });
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(subgraph) }] } };
      }

      if (name === 'search') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const q = (args.q || '').toLowerCase();
        const type = (args.type || '').toLowerCase();
        const results = N(dag).filter((n: any) =>
          (nodeName(n).toLowerCase().includes(q) || nodeId(n).toLowerCase().includes(q) || nt(n).toLowerCase().includes(q)) &&
          (!type || nt(n).toLowerCase().includes(type))
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
      }

      if (name === 'summary') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const tk = dag.tk || dag.tokens || {};
        const s = {
          project: P(dag),
          nodes: N(dag).length,
          edges: E(dag).length,
          version: dag.v || dag.version || (Array.isArray(dag) ? `${dag[0]}` : 'unknown'),
          order: dag.o || [],
          cycles: dag.cy !== undefined ? dag.cy : null,
          savings: tk.sv || tk.savings_pct || 0,
          method: tk.m || tk.method || '',
        };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(s) }] } };
      }

      if (name === 'schema') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = N(dag).find((n: any) => nodeMatches(n, args.entity || ''));
        if (!node) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Entity not found' } };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          entity: nodeName(node),
          properties: np(node),
          states: ns(node),
          lifecycle: nl(node),
        }) }] } };
      }

      if (name === 'listBlogs') {
        const blogDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'blog');
        const posts: any[] = [];
        if (existsSync(blogDir)) {
          for (const f of readdirSync(blogDir)) {
            if (!f.endsWith('.md')) continue;
            const raw = readFileSync(join(blogDir, f), 'utf-8');
            const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
            const title = fm.match(/title:\s*"([^"]+)"/)?.[1] || '';
            const desc = fm.match(/description:\s*"([^"]+)"/)?.[1] || '';
            const date = fm.match(/date:\s*(\S+)/)?.[1] || '';
            const slug = f.replace('.md', '');
            posts.push({ slug, title, description: desc, date, url: `https://specdog.github.io/dotdog/blog/${slug}` });
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(posts) }] } };
      }

      if (name === 'infraVerify') {
        // Query .dag for infra nodes (token-efficient, no re-parse)
        loadDags();
        const infraNodes: any[] = [];
        for (const [project, dag] of dagCache) {
          const nodes = N(dag);
          for (const node of nodes) {
            const t = nt(node);
            if (t === 'infra' || t === 'resource') {
              const props = np(node);
              const name = nodeName(node);
              infraNodes.push({
                entity: props.entity || '',
                provider: props.provider || '',
                resource: props.resource || '',
                region: props.region || '',
                tables: props.tables || '',
                nodeName: name,
                project,
              });
            }
          }
        }
        if (infraNodes.length === 0) {
          // Fall back to .dog parsing
          const { verifyInfra } = require('./infra/verify');
          try {
            const results = await verifyInfra({
              dir: root,
              providerFilter: args.provider as string | undefined,
              entityFilter: args.entity as string | undefined,
            });
            return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
          } catch (e: any) {
            return { jsonrpc: '2.0', id, error: { code: 500, message: `infraVerify failed: ${e.message}` } };
          }
        }
        // Filter
        let filtered = infraNodes;
        if (args.provider) {
          filtered = filtered.filter((n: any) => n.provider.toLowerCase() === String(args.provider).toLowerCase());
        }
        if (args.entity) {
          filtered = filtered.filter((n: any) => n.entity.toLowerCase() === String(args.entity).toLowerCase());
        }
        // Run provider checks
        const { verifyInfra } = require('./infra/verify');
        const checkResults = [];
        for (const node of filtered) {
          try {
            const result = await verifyInfra({
              dir: root,
              providerFilter: node.provider,
              entityFilter: node.entity,
            });
            checkResults.push(...result);
          } catch {
            checkResults.push({
              entity: node.entity, provider: node.provider, resource: node.resource,
              status: 'warn', message: 'check failed',
            });
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(checkResults) }] } };
      }

      return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown tool: ${name}` } };
    }

    return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown method: ${method}` } };
  }

  // Run MCP server over stdio
  const rl = readline.createInterface({ input: process.stdin });
  loadDags();
  
  console.error(`[spec-serve] Loaded ${dagCache.size} projects`);
  
  rl.on('line', async (line: string) => {
    try {
      const req = JSON.parse(line);
      const res = await handleRequest(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      process.stderr.write(`[spec-serve] Error: ${e}\n`);
    }
  });
}
