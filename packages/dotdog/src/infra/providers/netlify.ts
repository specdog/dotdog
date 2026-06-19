// Netlify provider — REST API (official MCP is thin, skip it)
// REST: api.netlify.com/api/v1
// Auth: NETLIFY_AUTH_TOKEN env var

import type { InfraResource, CheckResult, Provider } from './types';

function getToken(): string | null {
  return process.env.NETLIFY_AUTH_TOKEN || null;
}

async function restGet(path: string): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const token = getToken();
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set');

  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
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
    return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'skip', message: 'NETLIFY_AUTH_TOKEN not set' };
  }

  const [type, name] = resource.resource.split(':');

  try {
    if (type === 'site') {
      // Get site by name or ID
      const { ok, status, data } = await restGet(`/sites/${encodeURIComponent(name)}`);

      if (ok) {
        const d = data as Record<string, unknown>;
        const detail = `url: ${d.url || d.ssl_url || 'N/A'}, state: ${d.state || 'unknown'}`;
        return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'pass', message: `${d.state || 'exists'}`, detail };
      }

      if (status === 404) {
        return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'fail', message: 'not found', detail: 'HTTP 404' };
      }

      return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'warn', message: `HTTP ${status}` };
    }

    if (type === 'deploy') {
      const { ok, status, data } = await restGet(`/deploys/${encodeURIComponent(name)}`);
      if (ok) {
        const d = data as Record<string, unknown>;
        const detail = `state: ${d.state || 'unknown'}, branch: ${d.branch || 'N/A'}`;
        return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'pass', message: `${d.state || 'exists'}`, detail };
      }
      return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'fail', message: status === 404 ? 'not found' : `HTTP ${status}` };
    }

    return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'fail', message: `Unknown resource type: ${type}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entity: resource.entity, provider: 'netlify', resource: resource.resource, status: 'warn', message: `REST error: ${msg}` };
  }
}

export const netlifyProvider: Provider = {
  name: 'netlify',
  verify: verifyResource,
};
