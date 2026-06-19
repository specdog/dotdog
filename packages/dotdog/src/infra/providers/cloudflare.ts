// Cloudflare provider — MCP-first, REST fallback
// MCP: bindings.mcp.cloudflare.com (KV, R2, D1, Workers, Hyperdrive)
// REST: api.cloudflare.com/client/v4
// Auth: CLOUDFLARE_API_TOKEN env var

import type { InfraResource, CheckResult, Provider } from './types';
import { mask } from './types';
import { connectHTTP, type MCPConnection, type MCPTool } from '../mcp-client';

const MCP_URL = 'https://bindings.mcp.cloudflare.com/mcp';

function getToken(): string | null {
  return process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not set');
  return { Authorization: `Bearer ${token}` };
}

async function restCheck(path: string): Promise<{ exists: boolean; detail?: string }> {
  const base = 'https://api.cloudflare.com/client/v4';
  const res = await fetch(`${base}${path}`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { exists: false, detail: `HTTP ${res.status}` };
  const json = await res.json() as Record<string, unknown>;
  if (!json.success) return { exists: false, detail: (json.errors as Array<{message: string}>)?.[0]?.message || 'API error' };
  return { exists: true, detail: JSON.stringify(json.result).slice(0, 200) };
}

async function mcpCheck(mcp: MCPConnection, toolName: string, listTool: string, field: string, name: string, matchKey: string): Promise<CheckResult> {
  try {
    const tools = await mcp.listTools();
    const hasTool = tools.some((t: MCPTool) => t.name === listTool);
    if (!hasTool) return skip('Cloudflare MCP', name, `${listTool} tool unavailable`);

    const result = await mcp.callTool(listTool, {});
    const text = result.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text || '';
    const items = JSON.parse(text);

    // items may be {result: [...]} or just [...]
    const list = Array.isArray(items) ? items : (items.result || items.data || []);
    const found = list.find((item: Record<string, unknown>) => {
      const val = item[matchKey] || item.name || item.id || '';
      return String(val).toLowerCase() === name.toLowerCase();
    });

    if (found) {
      return {
        entity: '', provider: 'cloudflare', resource: name,
        status: 'pass', message: `exists`,
        detail: JSON.stringify(found).slice(0, 200),
      };
    }
    return {
      entity: '', provider: 'cloudflare', resource: name,
      status: 'fail', message: 'not found',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entity: '', provider: 'cloudflare', resource: name, status: 'warn', message: `MCP error: ${msg}` };
  }
}

function skip(entity: string, resource: string, message: string): CheckResult {
  return { entity, provider: 'cloudflare', resource, status: 'skip', message };
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const [type, name] = resource.resource.split(':');
  if (!type || !name) {
    return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: 'fail', message: 'Invalid resource format (expected type:name)' };
  }

  const token = getToken();
  if (!token) return skip(resource.entity, resource.resource, 'CLOUDFLARE_API_TOKEN not set');

  let mcp: MCPConnection | null = null;
  try { mcp = await connectHTTP(MCP_URL); } catch { /* MCP unavailable, use REST */ }

  try {
    if (type === 'r2') {
      if (mcp) {
        const result = await mcpCheck(mcp, 'r2', 'r2_buckets_list', 'bucket', name, 'name');
        result.entity = resource.entity;
        return result;
      }
      const { exists, detail } = await restCheck(`/accounts/:account_id/r2/buckets/${name}`);
      return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: exists ? 'pass' : 'fail', message: exists ? 'exists' : 'not found', detail };
    }

    if (type === 'd1') {
      if (mcp) return withEntity(await mcpCheck(mcp, 'd1', 'd1_databases_list', 'database', name, 'name'), resource.entity);
      const { exists, detail } = await restCheck(`/accounts/:account_id/d1/database/${name}`);
      return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: exists ? 'pass' : 'fail', message: exists ? 'exists' : 'not found', detail };
    }

    if (type === 'worker') {
      if (mcp) return withEntity(await mcpCheck(mcp, 'worker', 'workers_list', 'worker', name, 'id'), resource.entity);
      const { exists, detail } = await restCheck(`/accounts/:account_id/workers/scripts/${name}`);
      return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: exists ? 'pass' : 'fail', message: exists ? 'exists' : 'not found', detail };
    }

    if (type === 'kv') {
      if (mcp) return withEntity(await mcpCheck(mcp, 'kv', 'kv_namespaces_list', 'namespace', name, 'title'), resource.entity);
      const { exists, detail } = await restCheck(`/accounts/:account_id/storage/kv/namespaces/${name}`);
      return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: exists ? 'pass' : 'fail', message: exists ? 'exists' : 'not found', detail };
    }

    return { entity: resource.entity, provider: 'cloudflare', resource: resource.resource, status: 'fail', message: `Unknown resource type: ${type}` };
  } finally {
    mcp?.close();
  }
}

function withEntity(r: CheckResult, entity: string): CheckResult {
  r.entity = entity;
  return r;
}

export const cloudflareProvider: Provider = {
  name: 'cloudflare',
  verify: verifyResource,
};
