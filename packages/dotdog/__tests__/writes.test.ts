import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, linkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { writeRepoMap } from '../src/map/repoMapper';
const dirs: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'dotdog-writes-')); dirs.push(dir); return dir; };
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

test('replacing a generated hard link cannot truncate its other owner', () => {
  const root = fixture(), outside = fixture(), directory = join(root, '.doghouse/generated');
  mkdirSync(directory, { recursive: true });
  const original = join(outside, 'preserve');
  writeFileSync(original, 'user evidence');
  linkSync(original, join(directory, 'repo.dag'));
  writeRepoMap(root, 'example', directory);
  expect(readFileSync(original, 'utf8')).toBe('user evidence');
  expect(JSON.parse(readFileSync(join(directory, 'repo.dag'), 'utf8')).project).toBe('example');
});

test('a killed graph writer leaves recoverable ownership; concurrent writers do not proceed', async () => {
  const root = fixture();
  const module = join(import.meta.dir, '../src/workspace/files.ts');
  const cli = join(import.meta.dir, '../src/cli.ts');
  const script = `import { withRepoLock } from ${JSON.stringify(pathToFileURL(module).href)}; withRepoLock(process.cwd(), () => { process.stdout.write('locked\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000); });`;
  const owner = Bun.spawn([process.execPath, '-e', script], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const reader = owner.stdout.getReader();
  try {
    const ready = await reader.read();
    expect(new TextDecoder().decode(ready.value)).toContain('locked');
    const second = Bun.spawn([process.execPath, cli, 'refresh', '--json'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    expect(await second.exited).toBe(1);
    expect(await new Response(second.stderr).text()).toContain('already in progress');
  } finally {
    owner.kill('SIGKILL'); await owner.exited; reader.releaseLock();
  }
  const recovered = Bun.spawn([process.execPath, cli, 'refresh', '--json'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  expect(await recovered.exited).toBe(0);
  expect(JSON.parse(await new Response(recovered.stdout).text()).ok).toBe(true);
});

test('CRLF source produces the same parsed graph structure as LF source', async () => {
  const { parse } = await import('../src/parser');
  const source = '## Model\n### Entity: Example\n```yaml\nentity: Example\ntype: entity\n```\n';
  expect(parse(source.replace(/\n/g, '\r\n'))).toEqual(parse(source));
});
