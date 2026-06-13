// spec serve — MCP server over stdio
// Exposes .dag graph to AI agents (supports compact v1.4 + legacy v1.3)

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
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

// Backward-compatible field accessors (v1.4 compact + v1.3 legacy)
const N = (dag: any) => dag.n || dag.nodes || [];
function nodeEdges(n: any): any[] { return n.es || []; }
function E(dag: any): any[] {
  if (dag.e) return dag.e; // v1.4 and earlier
  // v1.5+: collect all inline edges from nodes
  const edges: any[] = [];
  const seen = new Set<string>();
  for (const node of N(dag)) {
    for (const e of nodeEdges(node)) {
      const key = `${node.i||node.id}→${e.t}:${e.v}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ s: node.i || node.id, t: e.t, v: e.v, d: e.d, c: e.c, r: e.r });
      }
    }
  }
  return edges;
}
const P = (dag: any) => dag.p || dag.project || '';
const ni = (n: any) => n.i || n.id || '';
const nt = (n: any) => n.t || n.type || '';
const ng = (n: any) => n.g || n.category || '';
const nd = (n: any) => n.d || n.description || '';
const np = (n: any) => n.p || n.properties || {};
const ns = (n: any) => n.s || n.states || [];
const nl = (n: any) => n.l || n.lifecycle || [];
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
  function handleRequest(req: any): any {
    const { id, method, params } = req;

    // Initialize
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '0.1.0',
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
        const node = N(dag).find((n: any) => ni(n).toLowerCase() === (args.name || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{}' }] } };
        const edges = E(dag).filter((e: any) =>
          es(e).toLowerCase() === ni(node).toLowerCase() ||
          et(e).toLowerCase() === ni(node).toLowerCase()
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ...node, edges }) }] } };
      }

      if (name === 'traverse') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const depth = Math.min(Math.max(1, args.depth || 1), 20);
        const visitedNodes = new Set<string>();
        const visitedEdges = new Set<string>();
        const subgraph: { nodes: any[], edges: any[] } = { nodes: [], edges: [] };
        const queue = [{ id: args.from, depth: 0 }];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visitedNodes.has(curr.id) || curr.depth > depth) continue;
          visitedNodes.add(curr.id);
          const node = N(dag).find((n: any) => ni(n).toLowerCase() === curr.id.toLowerCase());
          if (node) subgraph.nodes.push(node);
          const edges = E(dag).filter((e: any) =>
            es(e).toLowerCase() === curr.id.toLowerCase() || et(e).toLowerCase() === curr.id.toLowerCase()
          );
          for (const e of edges) {
            const edgeKey = `${es(e)}→${et(e)}`;
            if (!visitedEdges.has(edgeKey)) {
              visitedEdges.add(edgeKey);
              subgraph.edges.push(e);
            }
            const next = es(e).toLowerCase() === curr.id.toLowerCase() ? et(e) : es(e);
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
          ni(n).toLowerCase().includes(q) && (!type || nt(n).toLowerCase().includes(type))
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
          version: dag.v || dag.version || '',
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
        const node = N(dag).find((n: any) => ni(n).toLowerCase() === (args.entity || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Entity not found' } };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          entity: ni(node),
          properties: np(node),
          states: ns(node),
          lifecycle: nl(node),
        }) }] } };
      }

      return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown tool: ${name}` } };
    }

    return { jsonrpc: '2.0', id, error: { code: 404, message: `Unknown method: ${method}` } };
  }

  // Run MCP server over stdio
  const rl = readline.createInterface({ input: process.stdin });
  loadDags();
  
  console.error(`[spec-serve] Loaded ${dagCache.size} projects`);
  
  rl.on('line', (line: string) => {
    try {
      const req = JSON.parse(line);
      const res = handleRequest(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      process.stderr.write(`[spec-serve] Error: ${e}\n`);
    }
  });
}
