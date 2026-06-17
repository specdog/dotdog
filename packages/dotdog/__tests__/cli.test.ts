import { describe, test, expect } from 'bun:test';
import { $, which } from 'bun';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setupTempProject } from './helpers';

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

  test('list shows temp project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-list-'));
    try {
      const projectName = 'testproj';
      setupTempProject(dir, projectName);
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts list`.text();
      expect(out).toContain(projectName);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('list --json outputs project names', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-list-json-'));
    try {
      const projectName = 'testproj';
      setupTempProject(dir, projectName);
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts list --json`.text();
      expect(JSON.parse(out)).toEqual([projectName]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('init creates a valid project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-init-'));
    try {
      const projectName = 'my-test-project';
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts init ${projectName}`.quiet();
      const projectDir = join(dir, 'specs', projectName);

      expect(existsSync(join(projectDir, 'SPEC.dog'))).toBe(true);
      expect(existsSync(join(projectDir, 'constitution.dog'))).toBe(true);
      expect(existsSync(join(projectDir, 'data-model.dog'))).toBe(true);

      const result = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts validate`.quiet();
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('kit init creates valid projects for built-in kits', async () => {
    const kitsDir = join(ROOT, 'packages', 'dotdog', 'kits');
    const kits = readdirSync(kitsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    expect(kits).toContain('erc20');
    expect(kits).toContain('defi');
    expect(kits).toContain('nft');
    expect(kits).toContain('hackathon');

    for (const kit of kits) {
      const dir = mkdtempSync(join(tmpdir(), `dotdog-kit-${kit}-`));
      try {
        await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts kit init ${kit}`.quiet();
        const projectDir = join(dir, 'specs', kit);

        expect(existsSync(join(projectDir, 'SPEC.dog'))).toBe(true);
        expect(existsSync(join(projectDir, 'constitution.dog'))).toBe(true);
        expect(existsSync(join(projectDir, 'data-model.dog'))).toBe(true);

        const result = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts validate`.quiet();
        expect(result.exitCode).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('visualize snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-viz-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts visualize`.text();
      expect(out).toMatchSnapshot();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('backward compat: visualize reads v1.5 format', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-backcompat-'));
    try {
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('tokens shows graph-only savings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-tokens-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts tokens`.text();
      expect(out).toContain('graph only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('serve returns valid getEntity response', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-serve-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();

      const proc = Bun.spawn([BUN, join(ROOT, 'packages/dotdog/src/cli.ts'), 'serve'], {
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
        cwd: dir,
      });
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
      await new Promise(r => setTimeout(r, 1000));
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'getEntity',arguments:{name:'Node'}}})+'\n');
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'schema',arguments:{entity:'Node'}}})+'\n');
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'search',arguments:{q:'Node'}}})+'\n');
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'traverse',arguments:{from:'Node',depth:1}}})+'\n');
      proc.stdin.end();
      const out = await new Response(proc.stdout).text();
      proc.kill();
      const lines = out.split('\n').filter(l => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(5);
      const init = JSON.parse(lines[0]);
      expect(init.result).toBeDefined();
      const entity = JSON.parse(JSON.parse(lines[1]).result.content[0].text);
      expect(entity.name).toBe('Node');
      expect(entity.properties.id).toBe('s!');
      const schema = JSON.parse(JSON.parse(lines[2]).result.content[0].text);
      expect(schema.entity).toBe('Node');
      const search = JSON.parse(JSON.parse(lines[3]).result.content[0].text);
      expect(search.some((node: any) => node[1] === 'Node')).toBe(true);
      const graph = JSON.parse(JSON.parse(lines[4]).result.content[0].text);
      expect(graph.nodes.some((node: any) => node.name === 'Node')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
