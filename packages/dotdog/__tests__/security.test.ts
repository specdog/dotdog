import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, rmSync, truncateSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { readGraphText } from '../src/graph/io';
import { normalizeGraph, graphNeighborhood } from '../src/graph/model';
import { resolveUserPath } from '../src/workspace/paths';
import { writeRepoMap, listRepoFiles } from '../src/map/repoMapper';

const dirs: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'dotdog-security-')); dirs.push(dir); return dir; };
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

test('dangling symlinks cannot redirect a new output outside the root', () => {
  const root = fixture(), outside = fixture();
  symlinkSync(join(outside, 'new-file'), join(root, 'output'));
  expect(() => resolveUserPath('output', root)).toThrow();
  expect(existsSync(join(outside, 'new-file'))).toBe(false);
});

test('mapper does not overwrite symlinked generated files', () => {
  const root = fixture(), outside = fixture();
  const destination = join(root, '.doghouse/generated');
  mkdirSync(destination, { recursive: true });
  const target = join(outside, 'evidence');
  writeFileSync(target, 'preserve');
  symlinkSync(target, join(destination, 'repo.dag'));
  expect(() => writeRepoMap(root, 'example', destination)).toThrow();
  expect(readFileSync(target, 'utf8')).toBe('preserve');
});

test('Git inventory does not follow a tracked directory replaced with a symlink', () => {
  const root = fixture(), outside = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/private.ts'), 'tracked');
  execFileSync('git', ['add', '.'], { cwd: root });
  rmSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(outside, 'private.ts'), 'outside secret');
  symlinkSync(outside, join(root, 'src'));
  expect(listRepoFiles(root)).not.toContain('src/private.ts');
});

test('forged hook ownership cannot delete another repository file', () => {
  const root = fixture();
  mkdirSync(join(root, '.doghouse/hooks'), { recursive: true });
  writeFileSync(join(root, 'keep.txt'), 'preserve');
  const sha256 = new Bun.CryptoHasher('sha256').update('preserve').digest('hex');
  writeFileSync(join(root, '.doghouse/hooks/git.json'), JSON.stringify({ path: 'keep.txt', sha256 }));
  const cli = join(import.meta.dir, '../src/cli.ts');
  const result = spawnSync(process.execPath, [cli, 'hooks', 'remove', '--agent', 'git'], { cwd: root, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(readFileSync(join(root, 'keep.txt'), 'utf8')).toBe('preserve');
});

test('step-like and malformed table lines cannot stall the parser process', () => {
  const root = fixture();
  mkdirSync(join(root, 'specs/example'), { recursive: true });
  writeFileSync(join(root, 'specs/example/SPEC.dog'), '## Scenario: example\n[1/1] Example action\n| not a table |\n');
  const result = spawnSync(process.execPath, [join(import.meta.dir, '../src/cli.ts'), 'compile'], { cwd: root, encoding: 'utf8', timeout: 5000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});

test('oversized MCP lines are rejected before JSON parsing', () => {
  const root = fixture();
  const result = spawnSync(process.execPath, [join(import.meta.dir, '../src/cli.ts'), 'serve'], { cwd: root, input: 'x'.repeat(1024 * 1024 + 1), encoding: 'utf8', timeout: 5000 });
  expect(result.error).toBeUndefined();
  expect(JSON.parse(result.stdout).error.message).toContain('exceeds 1 MiB');
});

test('graph readers reject directories and oversized files before parsing', () => {
  const root = fixture(), file = join(root, 'large.dag');
  expect(() => readGraphText(root)).toThrow('regular file');
  writeFileSync(file, '');
  truncateSync(file, 32 * 1024 * 1024 + 1);
  expect(() => readGraphText(file)).toThrow('32 MiB');
});

test('world queries cannot load graphs outside the selected repository', () => {
  const root = fixture(), outside = fixture();
  const file = join(outside, 'private.dag');
  writeFileSync(file, JSON.stringify({ version: '0.1', nodes: [{ id: 'private-secret' }], edges: [] }));
  const result = spawnSync(process.execPath, [join(import.meta.dir, '../src/cli.ts'), 'query', 'private', '--dag', file], { cwd: root, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain('private-secret');
});

test('ambiguous labels cannot silently retarget edges; exact IDs remain usable', () => {
  const raw = { nodes: [{ id: 'one', label: 'Duplicate' }, { id: 'two', label: 'Duplicate' }], edges: [{ sourceId: 'one', targetId: 'Duplicate', verb: 'links' }] };
  expect(() => normalizeGraph(raw)).toThrow('Ambiguous edge endpoint');
  raw.edges[0].targetId = 'two';
  const graph = normalizeGraph(raw);
  expect(graphNeighborhood(graph, 'Duplicate').ok).toBe(false);
  expect(graphNeighborhood(graph, 'one').ok).toBe(true);
});
