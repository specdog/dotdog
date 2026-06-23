export type WorkspaceMode = 'single-repo' | 'workspace';

export interface WorkspaceIdentity {
  id: string;
  name?: string;
  description?: string;
}

export interface RepoSpecConfig {
  enabled?: boolean;
  path?: string;
}

export interface RepoConfig {
  alias: string;
  role?: string;
  path: string;
  remote?: string;
  defaultBranch?: string;
  specs?: RepoSpecConfig;
}

export interface WorkspaceGroup {
  name: string;
  repos: string[];
}

export interface WorkspaceEdge {
  from: string;
  to: string;
  type: string;
  label?: string;
}

export interface WorkspaceConfig {
  version: 1;
  workspace: WorkspaceIdentity;
  repos: RepoConfig[];
  groups?: WorkspaceGroup[];
  edges?: WorkspaceEdge[];
}

export interface RepoContext {
  alias: string;
  role?: string;
  cwd: string;
  remote?: string;
  owner?: string;
  defaultBranch?: string;
  packageManager?: 'bun' | 'npm' | 'pnpm' | 'yarn' | 'unknown';
  specs?: RepoSpecConfig;
}

export type WorkspaceSelection =
  | { type: 'repo'; repo: string }
  | { type: 'group'; group: string }
  | { type: 'workspace' }
  | { type: 'current' };

export interface WorkspaceContext {
  mode: WorkspaceMode;
  manifestPath: string | null;
  workspaceRoot: string;
  config: WorkspaceConfig;
  repos: RepoContext[];
  registry: RepoRegistryLike;
}

export interface RepoRegistryLike {
  list(): RepoContext[];
  get(alias: string): RepoContext | null;
  require(alias: string): RepoContext;
  byRole(role: string): RepoContext[];
  group(name: string): RepoContext[];
  select(selection: WorkspaceSelection): RepoContext[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
