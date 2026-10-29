import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const version = JSON.parse(readFileSync('packages/dotdog/package.json')).version;
const temporary = mkdtempSync(join(tmpdir(), 'dotdog-release-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], { cwd: 'packages/dotdog', encoding: 'utf8' }))[0];
  execFileSync('tar', ['-xzf', join(temporary, packed.filename), '-C', temporary]);
  execFileSync('npm', ['install', '--prefix', join(temporary, 'consumer'), '--ignore-scripts', '--no-audit', '--no-fund', join(temporary, packed.filename)], { encoding: 'utf8' });
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
  console.log(`Packed release verified under Node ${process.versions.node} and Bun: ${packed.size} compressed bytes, ${packed.entryCount} files`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
