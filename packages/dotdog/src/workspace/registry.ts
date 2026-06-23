import type { RepoContext, WorkspaceContext, WorkspaceSelection } from './types';

export class RepoRegistry {
  private repos: RepoContext[];
  private groups: Map<string, string[]>;

  constructor(private context: WorkspaceContext) {
    this.repos = [...context.repos];
    this.groups = new Map((context.config.groups || []).map((group) => [group.name, [...group.repos]]));
  }

  list(): RepoContext[] {
    return [...this.repos];
  }

  get(alias: string): RepoContext | null {
    return this.repos.find((repo) => repo.alias === alias) || null;
  }

  require(alias: string): RepoContext {
    const repo = this.get(alias);
    if (!repo) throw new Error(`Unknown repo alias: ${alias}`);
    return repo;
  }

  byRole(role: string): RepoContext[] {
    return this.repos.filter((repo) => repo.role === role);
  }

  group(name: string): RepoContext[] {
    const aliases = this.groups.get(name);
    if (!aliases) throw new Error(`Unknown workspace group: ${name}`);
    return aliases.map((alias) => this.require(alias));
  }

  select(selection: WorkspaceSelection): RepoContext[] {
    if (selection.type === 'workspace') return this.list();
    if (selection.type === 'repo') return [this.require(selection.repo)];
    if (selection.type === 'group') return this.group(selection.group);
    if (selection.type === 'current') return this.context.mode === 'single-repo' ? this.list().slice(0, 1) : this.list();
    return [];
  }
}
