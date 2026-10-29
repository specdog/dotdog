import type { InfraResource, CheckResult, Provider } from './types';

async function verify(resource: InfraResource): Promise<CheckResult> {
  const base = { entity: resource.entity, provider: 'supabase', resource: resource.resource };
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return { ...base, status: 'skip', message: 'SUPABASE_ACCESS_TOKEN not set' };
  const [type, ref, extra] = resource.resource.split(':');
  if (type !== 'project' || !ref || extra) return { ...base, status: 'fail', message: 'Expected project:<ref>; table mappings use the tables field' };
  const res = await fetch('https://api.supabase.com/v1/projects', {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { ...base, status: 'warn', message: `HTTP ${res.status}` };
  const data = await res.json();
  if (!Array.isArray(data)) return { ...base, status: 'warn', message: 'Unexpected project-list response' };
  const found = data.find(project => (project.id || project.ref) === ref);
  if (!found) return { ...base, status: 'fail', message: 'project not found' };
  const children: CheckResult[] = (resource.tables || []).map(table => ({ ...base, resource: `table:${table}`, status: 'skip', message: 'Table schema was not checked by project metadata lookup' }));
  return { ...base, status: children.length ? 'warn' : 'pass', message: children.length ? 'Project exists; requested tables remain unverified' : 'project exists', ...(children.length ? { children } : {}) };
}
export const supabaseProvider: Provider = { name: 'supabase', verify };
