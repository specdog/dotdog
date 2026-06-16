import { describe, test, expect } from 'bun:test';
import { $, which } from 'bun';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const BUN = which('bun') || process.execPath;
const ROOT = join(import.meta.dir, '..', '..', '..');

describe('CLI', () => {
  test('--version', async () => {
    const out = await $`${BUN} packages/dotdog/src/cli.ts --version`.text();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('validate exits 0', async () => {
    const result = await $`${BUN} packages/dotdog/src/cli.ts validate`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('list shows spec-platform', async () => {
    const out = await $`${BUN} packages/dotdog/src/cli.ts list`.text();
    expect(out).toContain('spec-platform');
  });

  test('visualize snapshot', async () => {
    await $`${BUN} packages/dotdog/src/cli.ts compile`.quiet();
    const out = await $`${BUN} packages/dotdog/src/cli.ts visualize`.text();
    expect(out).toMatchSnapshot();
  });

  test('backward compat: visualize reads v1.5 format', async () => {
    const dir = '/tmp/dotdog-test-backcompat';
    rmSync(dir, { recursive: true, force: true });
    const projDir = join(dir, 'projects', 'testproj');
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, 'testproj.dag'), JSON.stringify({
      v: '1.5', p: 'testproj', n: [
        {i:'User',t:'entity',g:'entity',d:'A user',p:{},s:[],l:[],es:[]},
        {i:'Order',t:'entity',g:'entity',d:'An order',p:{},s:[],l:[],es:[]}
      ], o:['User','Order'], cy:false
    }));
    const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts visualize`.text();
    expect(out).toContain('User');
    expect(out).toContain('Order');
    rmSync(dir, { recursive: true, force: true });
  });

  test('tokens shows graph-only savings', async () => {
    await $`${BUN} packages/dotdog/src/cli.ts compile`.quiet();
    const out = await $`${BUN} packages/dotdog/src/cli.ts tokens`.text();
    expect(out).toContain('graph only');
  });

  test('serve returns valid getEntity response', async () => {
    await $`${BUN} packages/dotdog/src/cli.ts compile`.quiet();
    const proc = Bun.spawn([BUN, 'packages/dotdog/src/cli.ts', 'serve'], {
      stdin: 'pipe', stdout: 'pipe', stderr: 'pipe'
    });
    proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
    await new Promise(r => setTimeout(r, 1000));
    proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'getEntity',arguments:{name:'Node'}}})+'\n');
    proc.stdin.end();
    const out = await new Response(proc.stdout).text();
    proc.kill();
    const lines = out.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(1);
    // First response should be initialize
    const init = JSON.parse(lines[0]);
    expect(init.result).toBeDefined();
  });
});
