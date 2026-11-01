import { afterEach, expect, test } from 'bun:test';
import { cloudflareProvider } from '../src/infra/providers/cloudflare';
import { railwayProvider } from '../src/infra/providers/railway';
import { supabaseProvider } from '../src/infra/providers/supabase';
import { vercelProvider } from '../src/infra/providers/vercel';
import { netlifyProvider } from '../src/infra/providers/netlify';
import { verifyInfra } from '../src/infra/verify';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const originalFetch = globalThis.fetch;
const keys = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SUPABASE_ACCESS_TOKEN', 'RAILWAY_API_TOKEN', 'RAILWAY_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN'];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const dirs: string[] = [];
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const resource = (provider: string, resource: string) => ({ entity: 'fixture', provider, resource });

test('Cloudflare uses explicit account and resource IDs, never placeholder paths or MCP probes', async () => {
  process.env.CLOUDFLARE_API_TOKEN = 'fixture-token';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  const calls: string[] = [];
  globalThis.fetch = (async (url, init) => { calls.push(String(url)); expect(init?.redirect).toBe('error'); return Response.json({ success: true }); }) as typeof fetch;
  for (const input of ['r2:bucket', 'd1:db-id', 'worker:script', 'kv:namespace-id']) expect((await cloudflareProvider.verify(resource('cloudflare', input))).status).toBe('pass');
  expect(calls).toHaveLength(4);
  expect(calls[0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/r2/buckets/bucket`);
  expect((await cloudflareProvider.verify(resource('cloudflare', 'r2:..'))).status).toBe('fail');
  expect(calls).toHaveLength(4);
});

test('Railway parameterizes untrusted IDs and uses token-specific documented headers', async () => {
  process.env.RAILWAY_TOKEN = 'fixture-project-token';
  delete process.env.RAILWAY_API_TOKEN;
  const id = 'x") { injected } #';
  globalThis.fetch = (async (url, init) => {
    expect(String(url)).toBe('https://backboard.railway.com/graphql/v2');
    const body = JSON.parse(String(init?.body));
    expect(body.query).not.toContain(id);
    expect(body.variables.id).toBe(id);
    expect((init?.headers as Record<string, string>)['Project-Access-Token']).toBe('fixture-project-token');
    expect(init?.redirect).toBe('error');
    return Response.json({ data: { service: { id } } });
  }) as typeof fetch;
  expect((await railwayProvider.verify(resource('railway', 'service:' + id))).status).toBe('pass');
  globalThis.fetch = (async () => Response.json({ errors: [{ message: 'rejected' }] })) as typeof fetch;
  expect((await railwayProvider.verify(resource('railway', 'service:id'))).status).toBe('warn');
});

test('Supabase project existence cannot silently pass requested table checks', async () => {
  process.env.SUPABASE_ACCESS_TOKEN = 'fixture-token';
  globalThis.fetch = (async (url, init) => { expect(String(url)).toBe('https://api.supabase.com/v1/projects'); expect(init?.redirect).toBe('error'); return Response.json([{ id: 'ref' }]); }) as typeof fetch;
  const result = await supabaseProvider.verify({ ...resource('supabase', 'project:ref'), tables: ['users'] });
  expect(result.status).toBe('warn');
  expect(result.children?.[0].status).toBe('skip');
});

test('Vercel and Netlify refuse unsafe resource identifiers and credential redirects', async () => {
  process.env.VERCEL_TOKEN = process.env.NETLIFY_AUTH_TOKEN = 'fixture-token';
  globalThis.fetch = (async (_url, init) => { expect(init?.redirect).toBe('error'); return Response.json({}); }) as typeof fetch;
  expect((await vercelProvider.verify(resource('vercel', 'project:demo'))).status).toBe('pass');
  expect((await netlifyProvider.verify(resource('netlify', 'site:demo'))).status).toBe('pass');
  expect((await vercelProvider.verify(resource('vercel', 'project:..'))).status).toBe('fail');
  expect((await netlifyProvider.verify(resource('netlify', 'site:'))).status).toBe('fail');
});

test('infrastructure filters intersect; malformed specs do not become successful empty scans', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dotdog-provider-')); dirs.push(dir);
  writeFileSync(join(dir, 'fixture.dog'), '## Infrastructure\n```yaml\nresources:\n  - provider: vercel\n    resource: project:demo\n    entity: WrongEntity\n```\n');
  let calls = 0;
  process.env.VERCEL_TOKEN = 'fixture-token';
  globalThis.fetch = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  const result = await verifyInfra({ dir, providerFilter: 'vercel', entityFilter: 'Other' });
  expect(calls).toBe(0);
  expect(result[0].status).toBe('skip');
  writeFileSync(join(dir, 'fixture.dog'), '## Infrastructure\n```yaml\nresources:\n');
  await expect(verifyInfra({ dir })).rejects.toThrow();
});
