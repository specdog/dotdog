import { existsSync, readFileSync, realpathSync } from 'fs';
import path from 'path';
import { RepoRegistry } from './registry';
import type { RepoContext, WorkspaceConfig, WorkspaceContext } from './types';
import { validateWorkspaceConfig } from './validator';

export interface ResolveWorkspaceOptions {
  manifestPath?: string;
  requireManifest?: boolean;
}

export const WORKSPACE_MANIFEST = path.join('.doghouse', 'workspace.json');

export function findWorkspaceManifest(startDir: string): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(dir, WORKSPACE_MANIFEST);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveWorkspace(startDir = process.cwd(), options: ResolveWorkspaceOptions = {}): WorkspaceContext {
  const manifestPath = options.manifestPath ? path.resolve(startDir, options.manifestPath) : findWorkspaceManifest(startDir);
  if (!manifestPath) {
    if (options.requireManifest) throw new Error(`No ${WORKSPACE_MANIFEST} found from ${startDir}`);
    return singleRepoWorkspace(startDir);
  }

  const manifestDir = path.dirname(manifestPath);
  const config = JSON.parse(readFileSync(manifestPath, 'utf8')) as WorkspaceConfig;
  const result = validateWorkspaceConfig(config, { manifestDir, checkPaths: true });
  if (!result.valid) {
    throw new Error(`Invalid workspace manifest:\n${result.errors.map((err) => `- ${err.message}`).join('\n')}`);
  }

  const repos: RepoContext[] = config.repos.map((repo) => ({
    alias: repo.alias,
    role: repo.role,
    cwd: realpathSync.native(path.resolve(manifestDir, repo.path)),
    remote: repo.remote,
    defaultBranch: repo.defaultBranch,
    specs: repo.specs,
  }));

  const context = {
    mode: 'workspace' as const,
    manifestPath,
    workspaceRoot: path.dirname(manifestDir),
    config,
    repos,
    registry: undefined as unknown as RepoRegistry,
  } satisfies WorkspaceContext;
  context.registry = new RepoRegistry(context);
  return context;
}

function singleRepoWorkspace(startDir: string): WorkspaceContext {
  const cwd = realpathSync.native(path.resolve(startDir));
  const alias = path.basename(cwd) || 'repo';
  const config: WorkspaceConfig = {
    version: 1,
    workspace: { id: alias, name: alias },
    repos: [{ alias, role: 'unknown', path: cwd }],
  };
  const repos: RepoContext[] = [{ alias, role: 'unknown', cwd }];
  const context = {
    mode: 'single-repo' as const,
    manifestPath: null,
    workspaceRoot: cwd,
    config,
    repos,
    registry: undefined as unknown as RepoRegistry,
  } satisfies WorkspaceContext;
  context.registry = new RepoRegistry(context);
  return context;
}
