import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';
import { buildWorkspaceGraph } from '../src/workspace/graph';
import { resolveWorkspace } from '../src/workspace/resolver';
import { parseWorkspaceConfig, validateWorkspaceConfig } from '../src/workspace/validator';
import { isIgnoredRepoPath, resolveUserPath } from '../src/workspace/paths';
import { minimalChildEnv } from '../src/workspace/environment';

function fixtureWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'dotdog-workspace-'));
  const doghouse = path.join(root, '.doghouse');
  const repos = path.join(root, 'repos');
  mkdirSync(path.join(repos, 'example-interface'), { recursive: true });
  mkdirSync(path.join(repos, 'example-service'), { recursive: true });
  mkdirSync(path.join(repos, 'example-worker'), { recursive: true });
  mkdirSync(doghouse, { recursive: true });
  writeFileSync(path.join(doghouse, 'workspace.json'), JSON.stringify({
    version: 1,
    workspace: { id: 'example-workspace', name: 'example-workspace' },
    repos: [
      { alias: 'example-interface', role: 'web', path: '../repos/example-interface' },
      { alias: 'example-service', role: 'api', path: '../repos/example-service' },
      { alias: 'example-worker', role: 'worker', path: '../repos/example-worker' },
    ],
    groups: [{ name: 'core-flow', repos: ['example-interface', 'example-service', 'example-worker'] }],
    edges: [
      { from: 'example-interface', to: 'example-service', type: 'http' },
      { from: 'example-service', to: 'example-worker', type: 'event' },
    ],
  }, null, 2));
  return root;
}

describe('workspace bridge', () => {
  test('parsed data is exposed only after successful shape and reference validation', () => {
    const input = { version: 1, workspace: { id: 'example', name: 'Example' }, repos: [{ alias: 'app', path: '.', specs: { enabled: false, path: 'specs' } }], groups: [{ name: 'core', repos: ['app'] }], edges: [{ from: 'app', to: 'app', type: 'calls' }] };
    const result = parseWorkspaceConfig(input);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data).toEqual(input);
    const invalid = parseWorkspaceConfig({ ...input, edges: [{ from: 'app', to: 'missing', type: 'calls' }] });
    expect(invalid.valid).toBe(false);
    expect('data' in invalid).toBe(false);
    expect(validateWorkspaceConfig(input)).toEqual({ valid: true, errors: [], warnings: [] });
    expect(parseWorkspaceConfig({ ...input, groups: undefined }).valid).toBe(false);
    expect(parseWorkspaceConfig({ ...input, workspace: { id: 'example', name: undefined } }).valid).toBe(false);
  });

  test('parser result narrows under strict exact-optional checking and rejects invalid data access', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dotdog-workspace-types-'));
    const require = createRequire(import.meta.url);
    const compiler = require.resolve('typescript/package.json');
    const tsc = path.resolve(path.dirname(compiler), require(compiler).bin.tsc);
    const typeRoots = path.dirname(path.dirname(require.resolve('@types/node/package.json')));
    const file = path.join(root, 'contract.ts');
    const source = `import { parseWorkspaceConfig } from ${JSON.stringify(path.join(import.meta.dir, '../src/workspace/validator'))};\nimport type { WorkspaceConfig } from ${JSON.stringify(path.join(import.meta.dir, '../src/workspace/types'))};\nconst result = parseWorkspaceConfig(JSON.parse('{}'));\nif (result.valid === true) { const config: WorkspaceConfig = result.data; config.repos.map(repo => repo.alias); }\n`;
    const check = (code: string) => {
      writeFileSync(file, code);
      return spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '--strict', '--exactOptionalPropertyTypes', '--skipLibCheck', '--types', 'node', '--typeRoots', typeRoots, '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', file], { cwd: root, encoding: 'utf8', timeout: 15000 });
    };
    try {
      const valid = check(source);
      expect(valid.status).toBe(0);
      expect(valid.stdout).toBe('');
      const invalid = check(source + 'if (result.valid === false) { result.data; }');
      expect(invalid.status).toBe(1);
      expect(invalid.stdout.match(/error TS\d+/g)).toEqual(['error TS2339']);
      expect(invalid.stdout).toContain("Property 'data' does not exist");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('rejects malformed nested JSON without throwing or accepting incomplete groups', () => {
    const valid = { version: 1, workspace: { id: 'example' }, repos: [{ alias: 'app', path: '.' }] };
    expect(validateWorkspaceConfig(valid).valid).toBe(true);
    for (const invalid of [
      { ...valid, repos: [null] }, { ...valid, repos: [1] }, { ...valid, repos: [false] },
      { ...valid, groups: {} }, { ...valid, groups: null }, { ...valid, groups: [null] },
      { ...valid, groups: [{ name: 'core' }] }, { ...valid, groups: [{ name: 1, repos: ['app'] }] },
      { ...valid, groups: [{ name: 'core', repos: 'app' }] },
      { ...valid, edges: {} }, { ...valid, edges: [null] },
      { ...valid, edges: [{ from: 'app', to: 'app', type: {} }] },
      { ...valid, workspace: { id: 'example', name: {} } },
      { ...valid, repos: [{ alias: 'app', path: '.', role: {} }] },
      { ...valid, repos: [{ alias: 'app', path: '.', specs: true }] },
      { ...valid, repos: [{ alias: 'app', path: '.', specs: { enabled: 'yes' } }] },
    ]) {
      const result = validateWorkspaceConfig(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  test('resolver reports malformed input as validation errors before constructing the registry', () => {
    const root = fixtureWorkspace();
    writeFileSync(path.join(root, '.doghouse/workspace.json'), JSON.stringify({
      version: 1, workspace: { id: 'example' }, repos: [{ alias: 'app', path: '..' }], groups: [{ name: 'core' }],
    }));
    expect(() => resolveWorkspace(root)).toThrow('Invalid workspace manifest');
  });

  test('validates duplicate aliases and unknown edges', () => {
    const result = validateWorkspaceConfig({
      version: 1,
      workspace: { id: 'example-workspace' },
      repos: [
        { alias: 'example-service', path: '.' },
        { alias: 'example-service', path: '.' },
      ],
      edges: [{ from: 'example-service', to: 'example-worker', type: 'http' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('duplicate_repo_alias');
    expect(result.errors.map((error) => error.code)).toContain('unknown_edge_to');
  });

  test('loads a workspace manifest and builds deterministic graph facts', () => {
    const root = fixtureWorkspace();
    const context = resolveWorkspace(root);
    expect(context.mode).toBe('workspace');
    expect(context.repos.map((repo) => repo.alias)).toEqual(['example-interface', 'example-service', 'example-worker']);
    const graph = buildWorkspaceGraph(context);
    expect(graph.workspace).toBe('example-workspace');
    expect(graph.nodes.map((node) => node.id)).toContain('repo:example-service');
    expect(graph.edges.map((edge) => edge.type)).toContain('http');
    expect(graph.nodes.every((node) => !node.path || !path.isAbsolute(node.path))).toBe(true);
  });

  test('blocks parent path traversal and ignores secret paths', () => {
    const root = fixtureWorkspace();
    expect(() => resolveUserPath('..', root)).toThrow();
    expect(isIgnoredRepoPath('.env')).toBe(true);
    expect(isIgnoredRepoPath('src/index.ts')).toBe(false);
  });

  test('child process environment excludes unrelated credentials', () => {
    const env = minimalChildEnv({ RAILWAY_TOKEN: 'test-token' });
    expect(env.RAILWAY_TOKEN).toBe('test-token');
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });

  test('workspace list JSON does not expose absolute paths', () => {
    const root = fixtureWorkspace();
    const result = Bun.spawnSync([
      process.execPath,
      path.join(import.meta.dir, '../src/cli.ts'),
      'workspace',
      'list',
      '--json',
    ], { cwd: root });
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout.toString());
    expect(output.repos.every((repo: any) => !path.isAbsolute(repo.path))).toBe(true);
    expect(output.repos.every((repo: any) => repo.cwd === repo.path)).toBe(true);
  });
});
