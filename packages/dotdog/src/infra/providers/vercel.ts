// Vercel provider — REST API (community MCP is thin, skip it)
// REST: api.vercel.com
// Auth: VERCEL_TOKEN env var

import type { InfraResource, CheckResult, Provider } from './types';

function getToken(): string | null {
  return process.env.VERCEL_TOKEN || null;
}

async function restGet(path: string): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const token = getToken();
  if (!token) throw new Error('VERCEL_TOKEN not set');

  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  return { ok: true, status: res.status, data };
}

async function verifyResource(resource: InfraResource): Promise<CheckResult> {
  const token = getToken();
  if (!token) {
    return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'skip', message: 'VERCEL_TOKEN not set' };
  }

  const [type, name] = resource.resource.split(':');

  try {
    if (type === 'project') {
      // Try by name first
      const { ok, status, data } = await restGet(`/v9/projects/${encodeURIComponent(name)}`);

      if (ok) {
        const d = data as Record<string, unknown>;
        const detail = `framework: ${d.framework || 'unknown'}, updated: ${String(d.updatedAt || 'unknown').slice(0, 10)}`;
        return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'pass', message: 'exists', detail };
      }

      if (status === 404) {
        return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'fail', message: 'not found', detail: 'HTTP 404' };
      }

      return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'warn', message: `HTTP ${status}`, detail: 'Check VERCEL_TOKEN scope' };
    }

    if (type === 'deployment') {
      const { ok, status, data } = await restGet(`/v13/deployments/${encodeURIComponent(name)}`);
      if (ok) {
        const d = data as Record<string, unknown>;
        const detail = `state: ${d.state || 'unknown'}, url: ${d.url || 'N/A'}`;
        return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'pass', message: `${d.state || 'exists'}`, detail };
      }
      return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'fail', message: status === 404 ? 'not found' : `HTTP ${status}` };
    }

    return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'fail', message: `Unknown resource type: ${type}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entity: resource.entity, provider: 'vercel', resource: resource.resource, status: 'warn', message: `REST error: ${msg}` };
  }
}

export const vercelProvider: Provider = {
  name: 'vercel',
  verify: verifyResource,
};
