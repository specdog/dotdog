// spec serve — MCP server over stdio
// Exposes .dag graph to AI agents

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

function resolvePath(p: string): string {
  if (p.startsWith('~')) p = join(homedir(), p.slice(1));
  return p.startsWith('/') ? p : join(process.cwd(), p);
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
            { name: 'getEntity', description: 'Get entity by name from .dag graph', inputSchema: { type: 'object', properties: { project: { type:'string' }, name: { type:'string' } } } },
            { name: 'getEdges', description: 'Get all edges from or to an entity', inputSchema: { type: 'object', properties: { project: { type:'string' }, node: { type:'string' } } } },
            { name: 'listProjects', description: 'List all projects with .dag graphs', inputSchema: { type: 'object', properties: {} } },
            { name: 'listNodes', description: 'List all nodes in a project', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
            { name: 'getGraph', description: 'Get full .dag graph for a project', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
            { name: 'compile', description: 'Recompile .dog files to .dag', inputSchema: { type: 'object', properties: { project: { type:'string' } } } },
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
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(node) }] } };
      }

      if (name === 'getEdges') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        const edges = (dag.edges || []).filter((e: any) => 
          e.source.toLowerCase() === (args.node||'').toLowerCase() || 
          e.target.toLowerCase() === (args.node||'').toLowerCase()
        );
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(edges) }] } };
      }

      if (name === 'getGraph') {
        const dag = dagCache.get(args.project || [...dagCache.keys()][0] || '');
        if (!dag) return { jsonrpc: '2.0', id, error: { code: 404, message: 'Project not found' } };
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(dag) }] } };
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
