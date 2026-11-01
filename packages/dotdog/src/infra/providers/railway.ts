import type { InfraResource, CheckResult, Provider } from './types';

async function verify(resource: InfraResource): Promise<CheckResult> {
  const base = { entity: resource.entity, provider: 'railway', resource: resource.resource };
  const token = process.env.RAILWAY_API_TOKEN || process.env.RAILWAY_TOKEN;
  if (!token) return { ...base, status: 'skip', message: 'RAILWAY_API_TOKEN (account/workspace) or RAILWAY_TOKEN (project) not set' };
  const [type, id, extra] = resource.resource.split(':');
  if (type !== 'service' || !id || extra) return { ...base, status: 'fail', message: 'Expected service:<service-id>, not a service name' };
  const headers: Record<string, string> = process.env.RAILWAY_API_TOKEN ? { Authorization: `Bearer ${token}` } : { 'Project-Access-Token': token };
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, redirect: 'error',
    body: JSON.stringify({ query: 'query service($id: String!) { service(id: $id) { id name } }', variables: { id } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { ...base, status: 'warn', message: `HTTP ${res.status}` };
  const data = await res.json() as any;
  if (data.errors?.length) return { ...base, status: 'warn', message: 'Railway query failed; check token scope and service ID' };
  return data.data?.service?.id === id ? { ...base, status: 'pass', message: 'service exists' } : { ...base, status: 'fail', message: 'service not found' };
}
export const railwayProvider: Provider = { name: 'railway', verify };
