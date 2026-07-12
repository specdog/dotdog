// spec serve — MCP server over stdio
// Exposes .dag graph to AI agents. v3 format only.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { parse } from './parser';
import { resolveUserPath } from './workspace/paths';
import { resolveWorkspace } from './workspace/resolver';
import { portableWorkspacePath } from './workspace/graph';

function resolvePath(p: string): string {
  return resolveUserPath(p, process.cwd());
}

// --- v3-only helpers ---
// Node: [name: string, typeCode: 'e'|'p'|'i', props: [k,v]|null, states: []|null, edges: [[tgtIdx,verb]]|null]
// DAG:  [3, project: string, nodes: v3node[], tokens: object]

const TYPE: Record<string,string> = { e:'entity', p:'prediction', i:'infra' };

const Nm = (n: any) => Array.isArray(n) ? n[0] : (n.label || n.id || '');                          // name
const Nt = (n: any) => Array.isArray(n) ? (TYPE[n[1]] || 'entity') : (n.kind || 'entity');        // type
const Np = (n: any) => {
  if (!Array.isArray(n)) return n.properties || {};
  const flat = n[2] || [];
  if (!Array.isArray(flat)) return (flat && typeof flat === 'object') ? flat : {};
  const obj: Record<string,string> = {};
  if (flat.length && Array.isArray(flat[0])) {
    for (const pair of flat) obj[String(pair[0])] = String(pair[1] ?? '');
    return obj;
  }
  for (let i = 0; i < flat.length; i += 2) obj[String(flat[i])] = String(flat[i+1] ?? '');
  return obj;
};
const Ns = (n: any) => Array.isArray(n) ? (n[3] || []) : [];                    // states
const Ne = (n: any, dag?: any) => {
  if (!Array.isArray(n)) return (dag?.edges || []).filter((e: any) => e.sourceId === n.id).map((e: any) => {
    const target = nodes(dag || {}).find((node: any) => node.id === e.targetId);
    return { s: Nm(n), t: target ? Nm(target) : e.targetId, v: e.verb || '', c: '', r: 0 };
  });
  return (n[4] || []).map((e: any[]) => ({ s: Nm(n), t: String(e[0]), v: e[1] || '', c: e[2] || '', r: e[3] || 0 }));
};

const nodes = (dag: any): any[] => dag.nodes || dag.n || (Array.isArray(dag) ? dag[2] : []) || [];
const project = (dag: any): string => dag.project || dag.p || dag[1] || '';
const tokens = (dag: any): any => dag.tk || dag.tokens || (Array.isArray(dag) ? dag[3] : {}) || {};

function allEdges(dag: any): any[] {
  if (Array.isArray(dag.edges)) return dag.edges.map((e: any) => {
    const source = nodes(dag).find((node: any) => node.id === e.sourceId);
    const target = nodes(dag).find((node: any) => node.id === e.targetId);
    return { s: source ? Nm(source) : e.sourceId, t: target ? Nm(target) : e.targetId, v: e.verb || '', c: '', r: 0 };
  });
  const seen = new Set<string>();
  const edges: any[] = [];
  for (const n of nodes(dag)) {
    for (const e of Ne(n, dag)) {
      const key = `${e.s}→${e.t}:${e.v}`;
      if (!seen.has(key)) { seen.add(key); edges.push(e); }
    }
  }
  return edges;
}

export function serve(dir: string = '.'): void {
  const root = resolvePath(dir);
  const dagCache: Map<string, any> = new Map();
  const dagPaths: Map<string, string> = new Map();

  function loadDags(): string[] {
    const compiledDag = join(root, '.doghouse', 'compiled', 'repo.dag');
    if (existsSync(compiledDag)) {
      const dag = JSON.parse(readFileSync(compiledDag, 'utf-8'));
      const p = project(dag) || 'repo';
      dagCache.set(p, dag);
      dagPaths.set(p, join(root, '.doghouse'));
    }

    const dirs = [join(root,'projects'),join(root,'specs'),root];
    for (const dd of dirs) {
      if (!existsSync(dd)) continue;
      const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
      for (const p of projects) {
        const dagFile = join(dd,p,`${p}.dag`);
        if (existsSync(dagFile)) { dagCache.set(p, JSON.parse(readFileSync(dagFile,'utf-8'))); dagPaths.set(p, join(dd,p)); }
      }
      // Also check root-level .dag files
      try { for (const f of readdirSync(dd)) { if (f.endsWith('.dag')) {
        const p = f.replace('.dag','');
        if (!dagCache.has(p)) dagCache.set(p, JSON.parse(readFileSync(join(dd,f),'utf-8')));
      }}} catch {}
    }
    return [...dagCache.keys()];
  }

  async function handleRequest(req: any): Promise<any> {
    const { id, method, params } = req;

    if (method === 'initialize') {
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'spec-serve', version: '0.1.0' },
        capabilities: { tools: {} }
      }};
    }

    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: [
        { name: 'getEntity', description: 'Get entity: name, type, edges', inputSchema: { type: 'object', properties: { project: { type:'string' }, name: { type:'string' } }, required: ['name'] } },
        { name: 'traverse', description: 'BFS from node, return reachable nodes+edges', inputSchema: { type: 'object', properties: { project: { type:'string' }, from: { type:'string' }, depth: { type:'number', default: 2 }, verb: { type:'string' } }, required: ['from'] } },
        { name: 'search', description: 'Find entities by name', inputSchema: { type: 'object', properties: { project: { type:'string' }, q: { type:'string' }, type: { type:'string' } }, required: ['q'] } },
        { name: 'listProjects', description: 'List loaded projects', inputSchema: { type: 'object', properties: {} } },
        { name: 'workspace.list', description: 'List workspace repos and groups', inputSchema: { type: 'object', properties: {} } },
        { name: 'summary', description: 'Project stats: nodes, edges, savings', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
        { name: 'schema', description: 'Entity property schema', inputSchema: { type: 'object', properties: { project: { type:'string' }, entity: { type:'string' } }, required: ['entity'] } },
        { name: 'infraVerify', description: 'Verify infra resources', inputSchema: { type: 'object', properties: { provider: { type:'string' }, entity: { type:'string' }, summary: { type:'boolean' } } } },
      ]}};
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      loadDags();

      const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');

      if (name === 'listProjects') {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify([...dagCache.keys()]) }] } };
      }

      if (name === 'workspace.list') {
        const workspace = resolveWorkspace(root, { requireManifest: false });
        const repos = workspace.repos.map((repo) => {
          const path = portableWorkspacePath(workspace, repo.cwd);
          return { alias: repo.alias, role: repo.role, path, cwd: path };
        });
        const data = {
          workspace: workspace.config.workspace,
          mode: workspace.mode,
          repos,
          groups: workspace.config.groups || [],
          trustedAsInstruction: false,
          contentKind: 'workspace-metadata',
        };
        return { jsonrpc: '2.0', id, result: { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] } };
      }

      if (name === 'getEntity') {
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = nodes(dag).find((n: any) => Nm(n).toLowerCase() === (args.name || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{}' }] } };
        const props = Np(node);
        if (Object.keys(props).length === 0) {
          const projectDir = dagPaths.get(args.project || [...dagCache.keys()][0] || '');
          if (projectDir) {
            for (const f of readdirSync(projectDir).filter(x => x.endsWith('.dog'))) {
              try {
                const ast = parse(readFileSync(join(projectDir, f), 'utf-8'));
                for (const s of ast.sections) for (const b of s.blocks) {
                  if (b.kind === 'entity' && (b as any).name?.toLowerCase() === Nm(node).toLowerCase()) {
                    Object.assign(props, Object.fromEntries(Object.entries((b as any).properties || {}).map(([k,v]: any) => [k, `${v.type?.[0] || 's'}${v.required ? '!' : ''}`])));
                  }
                }
              } catch {}
            }
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          name: Nm(node), type: Nt(node), properties: props, edges: Ne(node, dag).map((e: any) => [e.t, e.v, e.c])
        }) }] } };
      }

      if (name === 'traverse') {
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const depth = Math.min(Math.max(1, args.depth || 2), 3);
        const verbFilter = (args.verb || '').toLowerCase();
        const visited = new Set<string>();
        const result: Array<{ name: string; edges: string[] }> = [];
        const start = nodes(dag).find((n: any) => Nm(n).toLowerCase() === (args.from || '').toLowerCase());
        const queue = [{ id: start ? Nm(start) : args.from, depth: 0 }];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visited.has(curr.id) || curr.depth > depth) continue;
          visited.add(curr.id);
          const node = nodes(dag).find((n: any) => Nm(n) === curr.id);
          if (node) {
            const edges = Ne(node, dag).filter((e: any) => !verbFilter || (e.v || '').toLowerCase() === verbFilter);
            result.push({ name: Nm(node), edges: edges.map((e: any) => `${e.t}:${e.v}${e.c ? '(' + e.c + ')' : ''}`) });
            for (const e of edges) {
              if (!visited.has(e.t)) queue.push({ id: e.t, depth: curr.depth + 1 });
            }
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ nodes: result }) }] } };
      }

      if (name === 'search') {
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const q = (args.q || '').toLowerCase();
        const tf = (args.type || '').toLowerCase();
        const results = nodes(dag)
          .filter((n: any) => Nm(n).toLowerCase().includes(q) && (!tf || Nt(n).toLowerCase().includes(tf)))
          .map((n: any) => [Nt(n), Nm(n)]);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
      }

      if (name === 'summary') {
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const tk = tokens(dag);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          project: project(dag), nodes: nodes(dag).length, edges: allEdges(dag).length,
          savings: tk.sv || 0
        }) }] } };
      }

      if (name === 'schema') {
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = nodes(dag).find((n: any) => Nm(n).toLowerCase() === (args.entity || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Entity not found' } };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          entity: Nm(node), properties: Np(node)
        }) }] } };
      }

      if (name === 'infraVerify') {
        loadDags();
        const infraNodes: any[] = [];
        for (const [prj, d] of dagCache) {
          for (const n of nodes(d)) {
            if (Nt(n) === 'infra') {
              const p = Np(n);
              infraNodes.push({ entity: p.entity || '', provider: p.provider || '', resource: p.resource || '', region: p.region || '', tables: p.tables || '', project: prj });
            }
          }
        }
        if (infraNodes.length === 0) {
          const { verifyInfra } = require('./infra/verify');
          try { const results = await verifyInfra({ dir: root, providerFilter: args.provider, entityFilter: args.entity });
            return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
          } catch (e: any) { return { jsonrpc: '2.0', id, error: { code: 500, message: e.message } }; }
        }
        let filtered = infraNodes;
        if (args.provider) filtered = filtered.filter((n: any) => n.provider.toLowerCase() === String(args.provider).toLowerCase());
        if (args.entity) filtered = filtered.filter((n: any) => n.entity.toLowerCase() === String(args.entity).toLowerCase());
        if (args.summary) {
          const bp: Record<string,number> = {}, be: Record<string,number> = {};
          for (const n of filtered) { bp[n.provider] = (bp[n.provider] || 0) + 1; be[n.entity] = (be[n.entity] || 0) + 1; }
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ total: filtered.length, byProvider: bp, byEntity: be, sample: filtered.slice(0, 3).map((n: any) => ({ entity: n.entity, provider: n.provider, resource: n.resource })) }) }] } };
        }
        const { verifyInfra } = require('./infra/verify');
        const results = [];
        for (const node of filtered) {
          try { results.push(...(await verifyInfra({ dir: root, providerFilter: node.provider, entityFilter: node.entity }))); }
          catch { results.push({ entity: node.entity, provider: node.provider, resource: node.resource, status: 'warn', message: 'check failed' }); }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
      }

      return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown tool: ${name}` } };
    }

    return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown method: ${method}` } };
  }

  const rl = readline.createInterface({ input: process.stdin });
  loadDags();
  console.error(`[spec-serve] Loaded ${dagCache.size} projects`);
  rl.on('line', async (line: string) => {
    try {
      const req = JSON.parse(line);
      const res = await handleRequest(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) { process.stderr.write(`[spec-serve] Error: ${e}\n`); }
  });
}
