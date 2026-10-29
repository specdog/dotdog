import type { InfraResource, CheckResult, Provider } from './types';

async function verify(resource: InfraResource): Promise<CheckResult> {
  const base = { entity: resource.entity, provider: 'cloudflare', resource: resource.resource };
  const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return { ...base, status: 'skip', message: 'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required' };
  if (!/^[a-f0-9]{32}$/i.test(account)) return { ...base, status: 'fail', message: 'Invalid Cloudflare account ID' };
  const [type, id, extra] = resource.resource.split(':');
  const routes: Record<string, string> = { r2: 'r2/buckets', d1: 'd1/database', worker: 'workers/scripts', kv: 'storage/kv/namespaces' };
  if (!Object.hasOwn(routes, type) || !id || extra || id === '.' || id === '..') return { ...base, status: 'fail', message: 'Expected r2:<bucket-name>, d1:<database-id>, worker:<script-name>, or kv:<namespace-id>' };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${routes[type]}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { ...base, status: res.status === 404 ? 'fail' : 'warn', message: res.status === 404 ? 'not found' : `HTTP ${res.status}` };
  const data = await res.json() as any;
  return { ...base, status: data.success === true ? 'pass' : 'warn', message: data.success === true ? 'resource exists' : 'Cloudflare API did not confirm resource existence' };
}
export const cloudflareProvider: Provider = { name: 'cloudflare', verify };
