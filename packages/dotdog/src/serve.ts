// spec serve — MCP server over stdio
// Exposes .dag graph to AI agents

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

function resolvePath(p: string): string {
  if (p.startsWith('~')) p = join(homedir(), p.slice(1));
  const resolved = p.startsWith('/') ? p : join(process.cwd(), p);
  if (!p.startsWith('/') && !p.startsWith('~')) {
    const rel = resolve(process.cwd(), p);
    if (!rel.startsWith(process.cwd() + '/') && rel !== process.cwd()) {
      throw new Error(`Path traversal blocked: ${p}`);
    }
    return rel;
  }
  return resolved;
}

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
            { name: 'summary', description: 'Get project summary: node count, edge count, completeness', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
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
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(dag.nodes || []) }] } };
      }

      if (name === 'getEntity') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = (dag.nodes || []).find((n: any) => n.id.toLowerCase() === (args.name || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{}' }] } };
        // Agent-optimized: return entity + its immediate edges
        const edges = (dag.edges || []).filter((e: any) => 
          e.source.toLowerCase() === node.id.toLowerCase() || 
          e.target.toLowerCase() === node.id.toLowerCase()
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ...node, edges }) }] } };
      }

      if (name === 'traverse') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const depth = Math.min(Math.max(1, args.depth || 1), 20);
        const visited = new Set<string>();
        const subgraph: { nodes: any[], edges: any[] } = { nodes: [], edges: [] };
        const queue = [{ id: args.from, depth: 0 }];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visited.has(curr.id) || curr.depth > depth) continue;
          visited.add(curr.id);
          const node = (dag.nodes || []).find((n: any) => n.id.toLowerCase() === curr.id.toLowerCase());
          if (node) subgraph.nodes.push(node);
          const edges = (dag.edges || []).filter((e: any) => 
            e.source.toLowerCase() === curr.id.toLowerCase() || e.target.toLowerCase() === curr.id.toLowerCase()
          );
          for (const e of edges) {
            subgraph.edges.push(e);
            const next = e.source.toLowerCase() === curr.id.toLowerCase() ? e.target : e.source;
            if (!visited.has(next)) queue.push({ id: next, depth: curr.depth + 1 });
          }
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(subgraph) }] } };
      }

      if (name === 'search') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const q = (args.q || '').toLowerCase();
        const type = (args.type || '').toLowerCase();
        const results = (dag.nodes || []).filter((n: any) => 
          n.id.toLowerCase().includes(q) && (!type || (n.type||'').toLowerCase().includes(type))
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(results) }] } };
      }

      if (name === 'summary') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const s = {
          project: dag.project,
          nodes: (dag.nodes||[]).length,
          edges: (dag.edges||[]).length,
          files: dag.files || dag.count || 0,
          compiled: dag.compiled_at,
        };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(s) }] } };
      }

      if (name === 'schema') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const node = (dag.nodes || []).find((n: any) => n.id.toLowerCase() === (args.entity || '').toLowerCase());
        if (!node) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Entity not found' } };
        // Agent-optimized: only return property schema, no prose
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({
          entity: node.id,
          properties: node.properties || {},
          states: node.states || [],
          lifecycle: node.lifecycle || [],
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
