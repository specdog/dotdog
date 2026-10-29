import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { normalizeGraph } from '../src/graph/model';
import { importReaCallGraph } from '../src/graph/commands';
import { auditGraph } from '../src/graph/audit';
import { graphStatus } from '../src/automation';
import { scenarioCheck, referenceCheck } from '../src/spec/checks';
import { setupTempProject } from './helpers';

const dirs: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'dotdog-release-audit-')); dirs.push(dir); return dir; };
const cli = join(import.meta.dir, '../src/cli.ts');
const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

test('read-only status detects changed inputs and missing outputs without repairing them', () => {
  const root = fixture();
  writeFileSync(join(root, 'a.ts'), 'export const a = 1;');
  expect(graphStatus(root).fresh).toBe(false);
  expect(run(root, 'refresh', '--json').status).toBe(0);
  const state = readFileSync(join(root, '.doghouse/refresh.json'));
  expect(run(root, 'status', '--json').status).toBe(0);
  writeFileSync(join(root, 'a.ts'), 'export const a = 2;');
  expect(run(root, 'status', '--json').status).toBe(1);
  expect(readFileSync(join(root, '.doghouse/refresh.json'))).toEqual(state);
});

test('scenario references select a single heading and use word boundaries', () => {
  const root = fixture(), directory = join(root, 'projects/example');
  setupTempProject(root, 'example');
  const spec = join(directory, 'SPEC.dog');
  writeFileSync(spec, readFileSync(spec, 'utf8') + '\n## Scenario: good\n[1/1] Node changes\n## Scenario: bad\n[1/1] SuperNode changes\n');
  expect(run(root, 'compile').status).toBe(0);
  expect(scenarioCheck(directory, 'good').ok).toBe(true);
  expect(scenarioCheck(directory, 'bad').ok).toBe(false);
  expect(scenarioCheck(directory, 'missing').ok).toBe(false);
});

test('reference checks reject escapes, unknown entities, and retired mapping generation', () => {
  const root = fixture(), directory = join(root, 'projects/example');
  setupTempProject(root, 'example');
  expect(run(root, 'compile').status).toBe(0);
  writeFileSync(join(root, 'model.ts'), 'export const id = 1;');
  const plan = join(directory, 'plan.dog');
  writeFileSync(plan, '## Verify\n### Entity: Node\nfile: model.ts\nproperties: [id]\n');
  expect(referenceCheck(root, directory).ok).toBe(true);
  writeFileSync(plan, '## Verify\n### Entity: Node\nfile: ../escape\nproperties: [id]\n');
  expect(referenceCheck(root, directory).ok).toBe(false);
  const before = readFileSync(plan);
  expect(run(root, 'verify', '--init').status).toBe(1);
  expect(readFileSync(plan)).toEqual(before);
});

test('embodied evidence checks detect stale, changed, failing and omitted coverage', () => {
  const root = fixture(), now = Date.parse('2026-10-29T00:00:00Z');
  writeFileSync(join(root, 'calibration.bin'), Buffer.from([0xff, 0x00, 0x80]));
  const raw = { nodes: [
    { id: 'robot', kind: 'asset' }, { id: 'sensor', kind: 'sensor' }, { id: 'motor', kind: 'actuator' },
    { id: 'hazard', kind: 'hazard' }, { id: 'requirement', kind: 'requirement' },
    { id: 'evidence', kind: 'evidence', properties: { file: 'calibration.bin', sha256: createHash('sha256').update(readFileSync(join(root, 'calibration.bin'))).digest('hex'), result: 'pass', observedAt: '2026-10-28T00:00:00Z' } },
  ], edges: [
    { sourceId: 'sensor', targetId: 'evidence', verb: 'calibrated_by' },
    { sourceId: 'requirement', targetId: 'evidence', verb: 'verified_by' },
    { sourceId: 'requirement', targetId: 'robot', verb: 'applies_to' },
    { sourceId: 'motor', targetId: 'requirement', verb: 'constrained_by' },
    { sourceId: 'hazard', targetId: 'requirement', verb: 'mitigated_by' },
  ] };
  const audit = () => auditGraph(normalizeGraph(raw), root, { profile: 'embodied', now });
  expect(audit().ok).toBe(true);
  raw.nodes[5].properties!.observedAt = '2020-01-01T00:00:00Z';
  expect(audit().findings.map(f => f.code)).toContain('stale_evidence');
  raw.nodes[5].properties!.observedAt = '2026-10-28T00:00:00Z';
  writeFileSync(join(root, 'calibration.bin'), 'tampered');
  expect(audit().findings.map(f => f.code)).toContain('invalid_artifact');
  raw.nodes[5].properties!.result = 'fail';
  expect(audit().findings.map(f => f.code)).toContain('unconfirmed_evidence');
  raw.edges.pop();
  expect(audit().findings.map(f => f.code)).toContain('unmapped_hazard');
});

test('real MCP SDK connects, discovers schemas, and calls Dotdog over stdio', async () => {
  const root = fixture();
  writeFileSync(join(root, 'example.dag'), JSON.stringify({ project: 'example', nodes: [{ id: 'a', label: 'A' }], edges: [] }));
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, 'serve'], cwd: root, stderr: 'pipe' });
  const client = new Client({ name: 'dotdog-regression', version: '1.0.0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(11);
    const response = await client.callTool({ name: 'getEntity', arguments: { project: 'example', name: 'A' } });
    expect(response.isError).toBe(false);
    expect(response.structuredContent?.name).toBe('A');
  } finally { await client.close(); }
});

test('endpoint contracts compare nested values, scalar types, arrays and false values', async () => {
  const { contractMismatches, endpointBody } = await import('../src/spec/contracts');
  expect(contractMismatches({ ok: true }, { ok: false })).toEqual(['$.ok']);
  expect(contractMismatches({ nested: { value: 0 } }, { nested: { value: '0' } })).toEqual(['$.nested.value']);
  expect(contractMismatches(false, false)).toEqual([]);
  expect(contractMismatches([1, 2], [1])).toEqual(['$']);
  expect(contractMismatches({ ok: true }, { ok: true, extra: 1 })).toEqual([]);
  await expect(endpointBody(new Response('x'.repeat(1024 * 1024 + 1)))).rejects.toThrow('exceeds 1 MiB');
});

test('the recorded real Ghidra export retains its observed call and coverage in Dotdog', () => {
  const base = join(import.meta.dir, '../../../examples/native');
  const verification = JSON.parse(readFileSync(join(base, 'verification.json'), 'utf8'));
  const bodyBytes = readFileSync(join(base, 'callgraph-ghidra.json'));
  expect(createHash('sha256').update(bodyBytes).digest('hex')).toBe(verification.exportSha256);
  const raw = JSON.parse(bodyBytes.toString('utf8'));
  const imported = importReaCallGraph(raw, 'native-fixture', 'callgraph-ghidra.json', verification.exportSha256, verification.binarySha256);
  expect(imported.nodes).toHaveLength(2);
  expect(imported.edges).toHaveLength(1);
  expect(imported.edges[0].evidence.relationship_coverage.status).toBe('complete');
  expect(imported.nodes[0].id).toContain(verification.binarySha256);
  expect(imported.coverage.scope).toBe('supplied REA traversal only');
});
