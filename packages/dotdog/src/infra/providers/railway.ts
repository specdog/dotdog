// Railway provider — MCP-first (bundled in CLI), REST fallback
// MCP: railway mcp (stdio via railway CLI)
// REST: backboard.railway.app/graphql
// Auth: RAILWAY_TOKEN env var

import type { InfraResource, CheckResult, Provider } from './types';
import { connectStdio, type MCPConnection, type MCPTool } from '../mcp-client';

function getToken(): string | null {
  return process.env.RAILWAY_TOKEN || null;
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const token = getToken();
  if (!token) {
    return { entity: resource.entity, provider: 'railway', resource: resource.resource, status: 'skip', message: 'RAILWAY_TOKEN not set' };
  }

  const [type, name] = resource.resource.split(':');

  if (type !== 'service') {
    return { entity: resource.entity, provider: 'railway', resource: resource.resource, status: 'fail', message: `Unknown resource type (expected service:<name>)` };
  }

  // Try MCP via railway CLI
  let mcp: MCPConnection | null = null;
  try {
    mcp = await connectStdio('railway', ['mcp'], { RAILWAY_TOKEN: token });
    const tools = await mcp.listTools();

    // Check for service-related tools
    const serviceTool = tools.find((t: MCPTool) =>
      t.name.includes('service') || t.name.includes('project') || t.name.includes('deploy')
    );

    if (serviceTool) {
      // Try to list services/projects
      const listTool = tools.find((t: MCPTool) => t.name.includes('list'));
      if (listTool) {
        const result = await mcp.callTool(listTool.name, {});
        const text = result.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text || '[]';
        const items = JSON.parse(text);
        const list = Array.isArray(items) ? items : (items.result || items.data || []);
        const found = list.find((item: Record<string, unknown>) => {
          const n = String(item.name || item.id || item.serviceName || '');
          return n.toLowerCase() === name.toLowerCase();
        });

        if (found) {
          return {
            entity: resource.entity, provider: 'railway', resource: resource.resource,
            status: 'pass', message: 'exists',
            detail: JSON.stringify(found).slice(0, 200),
          };
        }
        return {
          entity: resource.entity, provider: 'railway', resource: resource.resource,
          status: 'fail', message: 'not found',
        };
      }
    }
  } catch {
    // MCP failed, try REST fallback
  } finally {
    mcp?.close();
  }

  // REST fallback: GraphQL query
  try {
    const query = `{ service(name: "${name}") { id name status } }`;
    const res = await fetch('https://backboard.railway.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { entity: resource.entity, provider: 'railway', resource: resource.resource, status: 'fail', message: `HTTP ${res.status}` };
    }

    const json = await res.json() as Record<string, unknown>;
    const data = (json.data as Record<string, unknown>);
    const svc = data?.service;

    if (svc) {
      const s = svc as Record<string, unknown>;
      return {
        entity: resource.entity, provider: 'railway', resource: resource.resource,
        status: 'pass', message: `${s.status || 'exists'}`,
        detail: `id: ${s.id}`,
      };
    }

    return { entity: resource.entity, provider: 'railway', resource: resource.resource, status: 'fail', message: 'not found' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entity: resource.entity, provider: 'railway', resource: resource.resource, status: 'warn', message: `REST error: ${msg}` };
  }
}

export const railwayProvider: Provider = {
  name: 'railway',
  verify: verifyResource,
};
