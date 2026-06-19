// Supabase provider — MCP-first (official), REST fallback
// MCP: mcp.supabase.com/mcp (OAuth 2.1, read-only mode available)
// REST: api.supabase.com/v1
// Auth: SUPABASE_ACCESS_TOKEN env var

import type { InfraResource, CheckResult, Provider } from './types';
import { mask } from './types';
import { connectHTTP, type MCPConnection, type MCPTool } from '../mcp-client';

const MCP_URL = 'https://mcp.supabase.com/mcp';

function getToken(): string | null {
  return process.env.SUPABASE_ACCESS_TOKEN || null;
}

async function restList(path: string): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set');
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const token = getToken();
  if (!token) {
    return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'skip', message: 'SUPABASE_ACCESS_TOKEN not set' };
  }

  // Parse resource: "project:abc123" or "project:abc123:table:users"
  const parts = resource.resource.split(':');
  const resType = parts[0];

  if (resType !== 'project') {
    return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'fail', message: 'Unknown resource type (expected project:<ref>)' };
  }

  const projectRef = parts[1];
  if (!projectRef) {
    return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'fail', message: 'Missing project ref' };
  }

  // Try MCP first
  let mcp: MCPConnection | null = null;
  try { mcp = await connectHTTP(MCP_URL); } catch { /* fall through to REST */ }

  try {
    if (mcp) {
      const tools = await mcp.listTools();
      const hasListProjects = tools.some((t: MCPTool) => t.name === 'list_projects');

      if (hasListProjects) {
        const result = await mcp.callTool('list_projects', {});
        const text = result.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text || '[]';
        const projects = JSON.parse(text);
        const list = Array.isArray(projects) ? projects : (projects.result || projects.data || []);

        const found = list.find((p: Record<string, unknown>) => {
          const id = String(p.id || p.ref || '');
          return id === projectRef;
        });

        if (!found) {
          return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'fail', message: 'project not found', detail: `ref: ${projectRef}` };
        }

        const projectName = String(found.name || projectRef);
        const children: CheckResult[] = [];

        // If tables requested, check each
        if (resource.tables && resource.tables.length > 0) {
          const hasListTables = tools.some((t: MCPTool) => t.name === 'list_tables');
          if (hasListTables) {
            const tableResult = await mcp.callTool('list_tables', { schemas: ['public'] });
            const tableText = tableResult.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text || '[]';
            const tables = JSON.parse(tableText);
            const tableList = Array.isArray(tables) ? tables : (tables.result || tables.data || []);

            for (const tableName of resource.tables) {
              const tableFound = tableList.find((t: Record<string, unknown>) => {
                const n = String(t.name || t.table_name || '');
                return n.toLowerCase() === tableName.toLowerCase();
              });
              children.push({
                entity: resource.entity, provider: 'supabase',
                resource: `table:${tableName}`,
                status: tableFound ? 'pass' : 'fail',
                message: tableFound ? `${Object.keys(tableFound).length} columns` : 'table not found',
              });
            }
          }
        }

        return {
          entity: resource.entity, provider: 'supabase',
          resource: resource.resource,
          status: 'pass', message: `healthy (${projectName})`,
          children: children.length > 0 ? children : undefined,
        };
      }
    }
  } finally {
    mcp?.close();
  }

  // REST fallback
  try {
    const projects = await restList('/projects');
    if (!projects) {
      return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'fail', message: 'REST API request failed' };
    }
    const list = Array.isArray(projects) ? projects : [];
    const found = list.find((p: Record<string, unknown>) => String(p.id || p.ref || '') === projectRef);

    return {
      entity: resource.entity, provider: 'supabase', resource: resource.resource,
      status: found ? 'pass' : 'fail',
      message: found ? `exists (${found.name || projectRef})` : 'project not found',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entity: resource.entity, provider: 'supabase', resource: resource.resource, status: 'warn', message: `REST error: ${msg}` };
  }
}

export const supabaseProvider: Provider = {
  name: 'supabase',
  verify: verifyResource,
};
