import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { buildWorkspaceGraph } from '../src/workspace/graph';
import { resolveWorkspace } from '../src/workspace/resolver';
import { validateWorkspaceConfig } from '../src/workspace/validator';
import { isIgnoredRepoPath, resolveUserPath } from '../src/workspace/paths';

function fixtureWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'dotdog-workspace-'));
  const doghouse = path.join(root, '.doghouse');
  const repos = path.join(root, 'repos');
  mkdirSync(path.join(repos, 'example-web'), { recursive: true });
  mkdirSync(path.join(repos, 'example-api'), { recursive: true });
  mkdirSync(path.join(repos, 'example-worker'), { recursive: true });
  mkdirSync(doghouse, { recursive: true });
  writeFileSync(path.join(doghouse, 'workspace.json'), JSON.stringify({
    version: 1,
    workspace: { id: 'example-product', name: 'example-product' },
    repos: [
      { alias: 'example-web', role: 'web', path: '../repos/example-web' },
      { alias: 'example-api', role: 'api', path: '../repos/example-api' },
      { alias: 'example-worker', role: 'worker', path: '../repos/example-worker' },
    ],
    groups: [{ name: 'checkout', repos: ['example-web', 'example-api', 'example-worker'] }],
    edges: [
      { from: 'example-web', to: 'example-api', type: 'http' },
      { from: 'example-api', to: 'example-worker', type: 'event' },
    ],
  }, null, 2));
  return root;
}

describe('workspace bridge', () => {
  test('validates duplicate aliases and unknown edges', () => {
    const result = validateWorkspaceConfig({
      version: 1,
      workspace: { id: 'example-product' },
      repos: [
        { alias: 'example-api', path: '.' },
        { alias: 'example-api', path: '.' },
      ],
      edges: [{ from: 'example-api', to: 'example-worker', type: 'http' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('duplicate_repo_alias');
    expect(result.errors.map((error) => error.code)).toContain('unknown_edge_to');
  });

  test('loads a workspace manifest and builds deterministic graph facts', () => {
    const root = fixtureWorkspace();
    const context = resolveWorkspace(root);
    expect(context.mode).toBe('workspace');
    expect(context.repos.map((repo) => repo.alias)).toEqual(['example-web', 'example-api', 'example-worker']);
    const graph = buildWorkspaceGraph(context);
    expect(graph.workspace).toBe('example-product');
    expect(graph.nodes.map((node) => node.id)).toContain('repo:example-api');
    expect(graph.edges.map((edge) => edge.type)).toContain('http');
  });

  test('blocks parent path traversal and ignores secret paths', () => {
    const root = fixtureWorkspace();
    expect(() => resolveUserPath('..', root)).toThrow();
    expect(isIgnoredRepoPath('.env')).toBe(true);
    expect(isIgnoredRepoPath('src/index.ts')).toBe(false);
  });
});
