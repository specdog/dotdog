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
  });

  test('blocks parent path traversal and ignores secret paths', () => {
    const root = fixtureWorkspace();
    expect(() => resolveUserPath('..', root)).toThrow();
    expect(isIgnoredRepoPath('.env')).toBe(true);
    expect(isIgnoredRepoPath('src/index.ts')).toBe(false);
  });
});
