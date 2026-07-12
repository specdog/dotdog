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

  test('audit reports DAG shape as JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-audit-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts audit --require-kind entity --json projects/testproj/testproj.dag`.text();
      const result = JSON.parse(out);

      expect(result.ok).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
      expect(result.kinds.entity).toBeGreaterThan(0);
      expect(result.missingKinds).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('audit fails when required kind is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-audit-missing-'));
    try {
      setupTempProject(dir, 'testproj');
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      const result = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts audit --require-kind missing-kind --json projects/testproj/testproj.dag`.nothrow().quiet();

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout.toString()).missingKinds).toEqual(['missing-kind']);
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
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'workspace.list',arguments:{}}})+'\n');
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'path',arguments:{from:'Node',to:'Task'}}})+'\n');
      proc.stdin.end();
      const out = await new Response(proc.stdout).text();
      proc.kill();
      const lines = out.split('\n').filter(l => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(7);
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
      const workspace = JSON.parse(JSON.parse(lines[5]).result.content[0].text);
      expect(workspace.repos[0].path).toBe('.');
      expect(workspace.repos[0].cwd).toBe('.');
      const pathResult = JSON.parse(lines[6]).result.structuredContent;
      expect(pathResult.ok).toBe(true);
      expect(pathResult.nodes.map((node: any) => node.label)).toEqual(['Node', 'Task']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('serve reads compiled .doghouse graph artifacts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-serve-compiled-'));
    try {
      mkdirSync(join(dir, '.doghouse', 'semantic'), { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'compiled-graph-app', version: '1.0.0' }, null, 2));
      writeFileSync(join(dir, 'railway.json'), JSON.stringify({ startCommand: 'bun start' }, null, 2));
      writeFileSync(join(dir, '.doghouse', 'semantic', 'deployment.dog'), [
        '## Deployment',
        '',
        '### Entity: Deployment',
        '',
        'A generic deployment capability.',
        '',
        '```yaml',
        'entity: Deployment',
        'type: external',
        '```',
        '',
        '### Entity: RailwayService',
        '',
        'A generic Railway deployment service.',
        '',
        '```yaml',
        'entity: RailwayService',
        'type: external',
        '```',
        '',
        '### Relationship: Deployment → RailwayService',
        '',
        '```yaml',
        'relationship: Deployment → RailwayService',
        'source: Deployment',
        'target: RailwayService',
        'verb: includes',
        '```',
      ].join('\n'));

      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts map . --project compiled-graph-app`.quiet();
      await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts compile`.quiet();
      expect(existsSync(join(dir, '.doghouse', 'compiled', 'repo.dag'))).toBe(true);

      const proc = Bun.spawn([BUN, join(ROOT, 'packages/dotdog/src/cli.ts'), 'serve'], {
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
        cwd: dir,
      });
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
      await new Promise(r => setTimeout(r, 1000));
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'getEntity',arguments:{name:'Deployment'}}})+'\n');
      proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'traverse',arguments:{from:'Deployment',depth:1}}})+'\n');
      proc.stdin.end();
      const out = await new Response(proc.stdout).text();
      proc.kill();

      const lines = out.split('\n').filter(l => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(3);
      const entity = JSON.parse(JSON.parse(lines[1]).result.content[0].text);
      expect(entity.name).toBe('Deployment');
      expect(entity.type).toBe('external');
      expect(entity.edges.some((edge: any) => edge[0] === 'RailwayService' && edge[1] === 'includes')).toBe(true);
      const graph = JSON.parse(JSON.parse(lines[2]).result.content[0].text);
      expect(graph.nodes.some((node: any) => node.name === 'Deployment')).toBe(true);
      expect(graph.nodes.some((node: any) => node.edges.some((edge: string) => edge.startsWith('RailwayService:includes')))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('path returns a shortest repo-world path as JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-test-path-'));
    try {
      const dagDir = join(dir, '.doghouse', 'compiled');
      mkdirSync(dagDir, { recursive: true });
      const dagFile = join(dagDir, 'repo.dag');
      writeFileSync(dagFile, JSON.stringify({
        version: '0.1', project: 'path-test', root: '.', generatedAt: '2026-01-01T00:00:00Z',
        nodes: [
          { id: 'symbol:user', kind: 'symbol', label: 'User Service', source: 'src/user.ts', confidence: 'certain' },
          { id: 'symbol:db', kind: 'symbol', label: 'Database Pool', source: 'src/db.ts', confidence: 'likely' },
        ],
        edges: [{ id: 'user-calls-db', sourceId: 'symbol:user', targetId: 'symbol:db', verb: 'calls', confidence: 'certain' }],
        predictions: [], unknowns: [],
      }));
      const out = await $`cd ${dir} && ${BUN} ${ROOT}/packages/dotdog/src/cli.ts path User Database --dag ${dagFile} --json`.text();
      const result = JSON.parse(out);
      expect(result.ok).toBe(true);
      expect(result.hops).toBe(1);
      expect(result.nodes[0].label).toBe('User Service');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
