import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { npm } from './lib/npm.mjs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/dotdog/package.json', import.meta.url));
const { countTokens } = require('gpt-tokenizer/encoding/o200k_base');

const version = JSON.parse(readFileSync('packages/dotdog/package.json')).version;
const { values } = parseArgs({ options: { output: { type: 'string' }, tarball: { type: 'string' } } });
if (values.output && values.tarball) throw new Error('Choose --output or --tarball, not both');
const temporary = mkdtempSync(join(tmpdir(), 'dotdog-release-'));
const output = values.output ? resolve(values.output) : temporary;
if (values.output) mkdirSync(output, { recursive: true });
try {
  const packed = values.tarball ? null : JSON.parse(npm(['pack', '--json', '--pack-destination', output], { cwd: 'packages/dotdog' }))[0];
  const artifact = values.tarball ? resolve(values.tarball) : join(output, packed.filename);
  const bytes = readFileSync(artifact);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  if (packed) assert.equal(integrity, packed.integrity);
  npm(['install', '--prefix', join(temporary, 'consumer'), '--ignore-scripts', '--no-audit', '--no-fund', artifact]);
  const cli = join(temporary, 'consumer/node_modules/dotdog/dist/cli.js');
  const project = join(temporary, 'project');
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'release-fixture', version: '1.0.0' }));
  writeFileSync(join(project, 'src/a.ts'), "import { value } from './b';\nexport const result = value;\n");
  writeFileSync(join(project, 'src/b.ts'), 'export const value = 1;\n');
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' });
  assert.equal(run('--version').trim(), version);
  run('skills', 'install');
  assert.ok(existsSync(join(project, '.agents/skills/dotdog/SKILL.md')));
  assert.ok(existsSync(join(project, '.claude/skills/dotdog/SKILL.md')));
  const refreshed = JSON.parse(run('refresh', '--json'));
  assert.ok(refreshed.nodes > 4);
  assert.equal(JSON.parse(run('refresh', '--if-stale', '--json')).changed, false);
  const impact = JSON.parse(run('impact', 'file:src/b.ts', '--json'));
  assert.ok(impact.nodes.some(node => node.label === 'file:src/a.ts'));
  const budgetArgs = ['context', 'file:src/b.ts', '--max-tokens', '1024', '--task', 'Review value exports'];
  for (const output of [run(...budgetArgs), execFileSync('bun', [cli, ...budgetArgs], { cwd: project, encoding: 'utf8' })]) {
    const context = JSON.parse(output);
    assert.equal(context.ok, true);
    assert.equal(context.budget.encoding, 'o200k_base');
    assert.ok(countTokens(output.trim(), { disallowedSpecial: new Set() }) <= 1024);
    assert.ok(context.nodes.some(node => node.label === 'symbol:src/b.ts#value'));
    assert.ok(context.edges.every(edge => context.nodes.some(node => node.id === edge.sourceId) && context.nodes.some(node => node.id === edge.targetId)));
  }
  assert.equal(JSON.parse(run('check', '--json')).ok, true);
  assert.equal(JSON.parse(run('status', '--json')).fresh, true);
  const evidence = 'Synthetic release fixture only; not a hardware measurement.\n';
  writeFileSync(join(project, 'evidence.txt'), evidence);
  const system = { project: 'bench-fixture', nodes: [
    { id: 'bench', kind: 'asset' }, { id: 'requirement', kind: 'requirement' },
    { id: 'record', kind: 'evidence', properties: { file: 'evidence.txt', sha256: createHash('sha256').update(evidence).digest('hex'), observedAt: new Date().toISOString(), result: 'pass' } },
  ], edges: [
    { sourceId: 'requirement', targetId: 'bench', verb: 'applies_to' },
    { sourceId: 'requirement', targetId: 'record', verb: 'verified_by' },
  ] };
  writeFileSync(join(project, 'system.json'), JSON.stringify(system));
  run('graph', 'import', 'system.json', '--project', 'bench-fixture');
  assert.equal(JSON.parse(run('graph', 'audit', '--dag', '.doghouse/imported/bench-fixture.dag', '--profile', 'embodied', '--json')).ok, true);
  writeFileSync(join(project, 'evidence.txt'), 'changed fixture');
  assert.throws(() => run('graph', 'audit', '--dag', '.doghouse/imported/bench-fixture.dag', '--profile', 'embodied', '--json'), error => error.status === 1);
  const bun = execFileSync('bun', [cli, '--version'], { cwd: project, encoding: 'utf8' }).trim();
  assert.equal(bun, version);
  const manifest = { version, artifact: basename(artifact), sha256, integrity, size: bytes.length, node: process.versions.node, verified: true };
  if (values.output) writeFileSync(join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
