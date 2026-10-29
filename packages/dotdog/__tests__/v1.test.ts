import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createMcpHandler } from '../src/serve';
import { normalizeGraph, graphNeighborhood } from '../src/graph/model';
import { shortestGraphPath } from '../src/graph/path';
import { importReaCallGraph } from '../src/graph/commands';
import { stableId } from '../src/dag/schema';
import { parse } from '../src/parser';
import Ajv2020 from 'ajv/dist/2020';
import { setupTempProject } from './helpers';

const cli = join(import.meta.dir, '../src/cli.ts');
const directories: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'dotdog-v1-')); directories.push(dir); return dir; };
const run = (cwd: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
};
const call = (name: string, args: any = {}) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const graph = [3, 'example', [['A', 'e', ['enabled', false, 'count', 0], ['new'], [[1, 'calls']]], ['B', 'e', null, null, null]], {}];

afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('1.0 graph contracts', () => {
  test('v2 and v3 share named relationships, zero/false values and path semantics', () => {
    const v2 = { v: 2, p: 'example', n: [[0, 'A', 'entity', '', ['enabled', false, 'count', 0], [], [[1, 'calls']]], [1, 'B', 'entity', '', [], [], []]] };
    for (const raw of [graph, v2]) {
      const normalized = normalizeGraph(raw);
      expect(normalized.nodes[0].properties).toEqual({ enabled: false, count: 0 });
      expect(graphNeighborhood(normalized, 'A', { direction: 'outgoing' }).nodes.map(node => node.label)).toEqual(['A', 'B']);
      expect(shortestGraphPath(raw, 'A', 'B').ok).toBe(true);
    }
  });

  test('rejects dangling and duplicate graph identity', () => {
    expect(() => normalizeGraph({ nodes: [{ id: 'a' }, { id: 'a' }], edges: [] })).toThrow('Duplicate');
    expect(() => normalizeGraph({ nodes: [{ id: 'a' }], edges: [{ sourceId: 'a', targetId: 'b', verb: 'calls' }] })).toThrow('Dangling');
    expect(stableId('file', 'A.ts')).not.toBe(stableId('file', 'a.ts'));
    expect(stableId('a:b', 'c')).not.toBe(stableId('a', 'b:c'));
    expect(() => normalizeGraph({ nodes: [{}], edges: [] })).toThrow('identity');
    expect(() => shortestGraphPath(graph, 'A', 'B', { maxHops: NaN })).toThrow('maxHops');
  });

  test('bounded impact preserves evidence and reports omissions', () => {
    const raw = { nodes: ['A', 'B', 'C'].map(id => ({ id })), edges: [
      { sourceId: 'A', targetId: 'C', verb: 'imports', evidence: { line: 3 } },
      { sourceId: 'B', targetId: 'C', verb: 'imports' },
    ] };
    const result = graphNeighborhood(normalizeGraph(raw), 'C', { direction: 'incoming', limit: 2 });
    expect(result.truncated).toBe(true);
    expect(result.nodes.length).toBe(2);
    expect(result.edges[0].evidence).toEqual({ line: 3 });
  });

  test('REA import preserves incomplete traversal evidence and binary scope', () => {
    const raw = { graph: { '0': [{ address: '0x1000', status: 'ok', calls: ['0x2000'], relationship_coverage: { status: 'partial', limitations: ['bounded'] } }] }, limitations: ['static only'] };
    const imported = importReaCallGraph(raw, 'native', 'evidence.json', 'a'.repeat(64), 'b'.repeat(64));
    const normalized = normalizeGraph(imported);
    expect(normalized.nodes.length).toBe(2);
    expect(normalized.edges[0].verb).toBe('calls');
    expect(normalized.edges[0].evidence).toEqual({ source: 'evidence.json', sha256: 'a'.repeat(64), relationship_coverage: raw.graph['0'][0].relationship_coverage });
    expect(imported.coverage.status).toBe('partial');
    expect(normalized.nodes[0].id).toContain('b'.repeat(64));
    expect(() => importReaCallGraph({ graph: { '0': [{}] }, limitations: [] }, 'native', 'x', 'a')).toThrow();
  });

  test('multiline optional booleans and ASCII lifecycle arrows retain semantics', () => {
    const ast = parse('## Model\n### Entity: A\n```yaml\nentity: A\nproperties:\n  flag:\n    type: boolean\n    required: false\n    default: false\nlifecycle: new -> active -> closed\n```\n');
    const entity: any = ast.sections.flatMap(section => section.blocks).find(block => block.kind === 'entity');
    expect(entity.properties.flag.required).toBe(false);
    expect(entity.properties.flag.default).toBe(false);
    expect(entity.lifecycle).toEqual(['new → active', 'active → closed']);
  });
});

describe('1.0 CLI and automation', () => {
  test('init cannot overwrite a populated kit or escape the specs directory', () => {
    const dir = fixture();
    expect(run(dir, 'kit', 'init', 'saas').code).toBe(0);
    const file = join(dir, 'specs/saas/SPEC.dog'), before = readFileSync(file);
    expect(run(dir, 'init', 'saas').code).toBe(1);
    expect(readFileSync(file)).toEqual(before);
    expect(run(dir, 'init', '../escape').code).toBe(1);
    expect(existsSync(join(dir, 'escape'))).toBe(false);
  });

  test('minimal init validates; empty directories and missing paths fail in CI', () => {
    const dir = fixture();
    expect(run(dir, 'validate').code).toBe(1);
    expect(run(dir, 'init', 'demo', '--minimal').code).toBe(0);
    expect(run(dir, 'validate').code).toBe(0);
    expect(run(dir, 'compile', 'specs/demo').out).not.toContain('No projects');
    expect(run(dir, 'path', 'unknown', 'missing', '--dag', 'specs/demo/demo.dag', '--json').code).toBe(1);
    expect(run(dir, 'drift', '--json').code).toBe(1);
  });

  test('schema survives compilation and tokens never measure an empty object', async () => {
    const dir = fixture();
    setupTempProject(dir, 'demo');
    expect(run(dir, 'compile').code).toBe(0);
    const output = run(dir, 'tokens').out;
    expect(output).not.toContain('payload: 2 bytes');
    const handle = createMcpHandler(dir);
    const result = await handle(call('schema', { entity: 'Node' }));
    expect(result.result.structuredContent.schema.id.type).toBe('string');
    expect(result.result.structuredContent.schema.id.required).toBe(true);
    const traversal = await handle(call('traverse', { from: 'Node' }));
    expect(traversal.result.structuredContent.nodes.map((node: any) => node.name)).toEqual(['Node', 'Task']);
  });

  test('fresh v3 endpoint contracts work and reject non-JSON bodies', async () => {
    let json = true;
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => json ? Response.json({ ok: true }) : new Response('not-json') });
    try {
      const dir = fixture(), project = join(dir, 'specs/live');
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, 'SPEC.dog'), `## Contracts\n### Endpoint: Health\n\`\`\`yaml\nentity: Health\ntype: endpoint\nproperties:\n  url:\n    type: string\n    default: http://127.0.0.1:${server.port}/health\n  expect_body:\n    type: json\n    default: { ok: true }\n\`\`\`\n`);
      expect(run(dir, 'compile').code).toBe(0);
      const live = async () => {
        const proc = Bun.spawn([process.execPath, cli, 'live', '--type', 'endpoint', '--exit-code', '--timeout', '1'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
        const out = await new Response(proc.stdout).text();
        return { code: await proc.exited, out };
      };
      const good = await live();
      expect(good.code).toBe(0);
      expect(good.out).toContain('1 passed');
      json = false;
      expect((await live()).code).not.toBe(0);
    } finally {
      server.stop(true);
    }
  });

  test('refresh repairs corrupted generated output and invalidates changed spec outputs', () => {
    const dir = fixture();
    setupTempProject(dir, 'demo');
    expect(run(dir, 'refresh', '--json').code).toBe(0);
    const generated = join(dir, '.doghouse/compiled/repo.dag');
    writeFileSync(generated, 'not-json');
    const repaired = run(dir, 'refresh', '--if-stale', '--json');
    expect(repaired.code).toBe(0);
    expect(JSON.parse(repaired.out).diffAvailable).toBe(false);
    const compiled = join(dir, 'projects/demo/demo.dag');
    writeFileSync(compiled, 'not-json');
    expect(JSON.parse(run(dir, 'refresh', '--if-stale', '--json').out).changed).toBe(true);
    expect(JSON.parse(readFileSync(compiled, 'utf8'))[0]).toBe(3);
  });

  test('AST mapping, impact and hash refresh handle edits, deletion and ignored files', () => {
    const dir = fixture();
    execFileSync('git', ['init', '-q'], { cwd: dir });
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, '.gitignore'), 'ignored.ts\n.doghouse/\n');
    writeFileSync(join(dir, 'ignored.ts'), 'export const secret = 1;');
    writeFileSync(join(dir, 'src/a.ts'), "import { b } from './b';\nexport const a = b;\n");
    writeFileSync(join(dir, 'src/b.ts'), 'export const b = 1;\n');
    const first = run(dir, 'refresh', '--json');
    expect(first.code).toBe(0);
    expect(JSON.parse(first.out).added.some((id: string) => id.includes('ignored'))).toBe(false);
    expect(JSON.parse(run(dir, 'refresh', '--if-stale', '--json').out).changed).toBe(false);
    const impact = JSON.parse(run(dir, 'impact', 'file:src/b.ts', '--json').out);
    expect(impact.nodes.some((node: any) => node.label === 'file:src/a.ts')).toBe(true);
    writeFileSync(join(dir, 'src/b.ts'), 'export const b = 2;\n');
    expect(JSON.parse(run(dir, 'refresh', '--if-stale', '--json').out).changedIds.length).toBeGreaterThan(0);
    unlinkSync(join(dir, 'src/b.ts'));
    const deleted = run(dir, 'refresh', '--json');
    expect(deleted.code).toBe(0);
    expect(JSON.parse(deleted.out).removed.some((id: string) => id.includes('src/b.ts'))).toBe(true);
  });

  test('mapping does not truncate at 500 files and recognizes root routes', () => {
    const dir = fixture();
    for (let i = 0; i < 501; i++) writeFileSync(join(dir, `${i}.md`), '# Fixture\n');
    mkdirSync(join(dir, 'app'));
    writeFileSync(join(dir, 'app/page.tsx'), 'export default function Home() { return null; }');
    const mapped = run(dir, 'map', '--json');
    expect(mapped.code).toBe(0);
    expect(JSON.parse(mapped.out).scanned).toBe(502);
    expect(run(dir, 'compile').code).toBe(0);
    expect(run(dir, 'context', 'route:/', '--json').code).toBe(0);
  });

  test('skills install is idempotent and preserves user edits', () => {
    const dir = fixture();
    expect(run(dir, 'skills', 'install').code).toBe(0);
    expect(run(dir, 'skills', 'install').code).toBe(0);
    const skill = join(dir, '.agents/skills/dotdog/SKILL.md');
    writeFileSync(skill, 'user edited');
    expect(run(dir, 'skills', 'install').code).toBe(1);
    expect(readFileSync(skill, 'utf8')).toBe('user edited');
    expect(existsSync(join(dir, '.claude/skills/dotdog/SKILL.md'))).toBe(true);
  });

  test('Claude hook install/remove preserves unrelated settings', () => {
    const dir = fixture();
    mkdirSync(join(dir, '.claude'));
    writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ env: { EXAMPLE: 'value' }, hooks: { PostToolUse: [{ matcher: 'Read', hooks: [] }] } }));
    expect(run(dir, 'hooks', 'install', '--agent', 'claude').code).toBe(0);
    expect(run(dir, 'hooks', 'install', '--agent', 'claude').code).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).hooks.PostToolUse.length).toBe(2);
    expect(run(dir, 'hooks', 'remove', '--agent', 'claude').code).toBe(0);
    const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
    expect(settings.env.EXAMPLE).toBe('value');
    expect(settings.hooks.PostToolUse).toEqual([{ matcher: 'Read', hooks: [] }]);
  });

  test('Git hooks are opt-in and staged checks read the index', () => {
    const dir = fixture();
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(join(dir, 'module.ts'), 'export const staged = 1;\n');
    execFileSync('git', ['add', 'module.ts'], { cwd: dir });
    expect(run(dir, 'hooks', 'install', '--agent', 'git').code).toBe(0);
    unlinkSync(join(dir, 'module.ts'));
    const staged = run(dir, 'check', '--staged', '--json');
    expect(staged.code).toBe(0);
    expect(JSON.parse(staged.out).nodes).toBeGreaterThan(1);
    expect(run(dir, 'hooks', 'remove', '--agent', 'git').code).toBe(0);
    expect(existsSync(join(dir, '.git/hooks/pre-commit'))).toBe(false);
  });
});

describe('1.0 MCP compatibility', () => {
  test('legacy negotiation, modern discovery, notifications, validation and cursor paging', async () => {
    const dir = fixture();
    writeFileSync(join(dir, 'example.dag'), JSON.stringify(graph));
    const handle = createMcpHandler(dir);
    const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
    expect(init.result.protocolVersion).toBe('2025-11-25');
    expect(init.result.serverInfo.version).toBe('1.0.0');
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect((await handle({ jsonrpc: '2.0', id: 1, method: 'ping' })).result).toEqual({});
    const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
    const discovery = await handle({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } });
    expect(discovery.result.supportedVersions).toContain('2026-07-28');
    expect((await handle(call('traverse', { from: 'A', depth: 999 }))).error.code).toBe(-32602);
    const optionalArgs = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'listProjects' } });
    expect(optionalArgs.result.structuredContent.items).toEqual(['example']);
    const result = await handle(call('search', { q: '', limit: 1 }));
    expect(result.result.structuredContent.nextCursor).toBe('1');
    const next = await handle(call('search', { q: '', limit: 1, cursor: '1' }));
    expect(next.result.structuredContent.items).toEqual([['entity', 'B']]);
    const tools = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta } });
    expect(tools.result.resultType).toBe('complete');
    expect(tools.result.tools.every((tool: any) => tool.outputSchema && tool.annotations.readOnlyHint)).toBe(true);
    const ajv = new Ajv2020({ strict: false });
    const inputs: any = { getEntity: { name: 'A' }, traverse: { from: 'A' }, path: { from: 'A', to: 'B' }, search: { q: '' }, schema: { entity: 'A' }, context: { q: 'A' }, impact: { from: 'B' }, infraVerify: { summary: true } };
    for (const tool of tools.result.tools) {
      const validate = ajv.compile(tool.outputSchema);
      const response = await handle(call(tool.name, inputs[tool.name] || {}));
      expect(response.result.isError).toBe(false);
      expect(validate(response.result.structuredContent)).toBe(true);
    }
  });

  test('deleted graph projects are evicted from a live handler', async () => {
    const dir = fixture(), file = join(dir, 'example.dag');
    writeFileSync(file, JSON.stringify(graph));
    const handle = createMcpHandler(dir);
    expect((await handle(call('listProjects'))).result.structuredContent.items).toEqual(['example']);
    unlinkSync(file);
    expect((await handle(call('listProjects'))).result.structuredContent.items).toEqual([]);
  });

  test('observed and authored projects with the same name remain separately queryable', async () => {
    const dir = fixture();
    mkdirSync(join(dir, '.doghouse/compiled'), { recursive: true });
    writeFileSync(join(dir, '.doghouse/compiled/repo.dag'), JSON.stringify({ project: 'example', nodes: [{ id: 'observed', label: 'Observed' }], edges: [] }));
    writeFileSync(join(dir, 'example.dag'), JSON.stringify(graph));
    const handle = createMcpHandler(dir);
    const projects = (await handle(call('listProjects'))).result.structuredContent.items;
    expect(projects).toEqual(['example', 'example:observed']);
    expect((await handle(call('getEntity', { project: 'example:observed', name: 'Observed' }))).result.structuredContent.name).toBe('Observed');
    expect((await handle(call('getEntity', { project: 'example', name: 'A' }))).result.structuredContent.name).toBe('A');
  });
});
