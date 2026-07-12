import type { WorkspaceContext } from './types';
import path from 'path';

export interface WorkspaceGraphNode {
  id: string;
  kind: 'workspace' | 'repo' | 'group' | 'spec' | 'external';
  label: string;
  repoAlias?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceGraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: string;
  confidence?: 'explicit' | 'compiled' | 'inferred' | 'unknown';
  metadata?: Record<string, unknown>;
}

export interface WorkspaceGraph {
  version: 1;
  workspace: string;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
}

export function buildWorkspaceGraph(context: WorkspaceContext): WorkspaceGraph {
  const workspaceId = context.config.workspace.id;
  const workspaceNodeId = `workspace:${workspaceId}`;
  const nodes: WorkspaceGraphNode[] = [{ id: workspaceNodeId, kind: 'workspace', label: workspaceId, path: '.' }];
  const edges: WorkspaceGraphEdge[] = [];

  for (const repo of [...context.repos].sort((a, b) => a.alias.localeCompare(b.alias))) {
    const repoNodeId = `repo:${repo.alias}`;
    nodes.push({ id: repoNodeId, kind: 'repo', label: repo.alias, repoAlias: repo.alias, path: portableWorkspacePath(context, repo.cwd), metadata: { role: repo.role || 'unknown' } });
    edges.push({ id: `${workspaceNodeId}:contains:${repoNodeId}`, from: workspaceNodeId, to: repoNodeId, type: 'contains', confidence: 'explicit' });
  }

  for (const group of [...(context.config.groups || [])].sort((a, b) => a.name.localeCompare(b.name))) {
    const groupNodeId = `group:${group.name}`;
    nodes.push({ id: groupNodeId, kind: 'group', label: group.name });
    edges.push({ id: `${workspaceNodeId}:contains:${groupNodeId}`, from: workspaceNodeId, to: groupNodeId, type: 'contains', confidence: 'explicit' });
    for (const alias of [...group.repos].sort()) {
      edges.push({ id: `${groupNodeId}:includes:repo:${alias}`, from: groupNodeId, to: `repo:${alias}`, type: 'includes', confidence: 'explicit' });
    }
  }

  for (const edge of [...(context.config.edges || [])].sort((a, b) => `${a.from}:${a.to}:${a.type}`.localeCompare(`${b.from}:${b.to}:${b.type}`))) {
    edges.push({ id: `repo:${edge.from}:${edge.type}:repo:${edge.to}`, from: `repo:${edge.from}`, to: `repo:${edge.to}`, type: edge.type, label: edge.label, confidence: 'explicit' });
  }

  return {
    version: 1,
    workspace: workspaceId,
    nodes: nodes.sort((a, b) => graphNodeRank(a).localeCompare(graphNodeRank(b))),
    edges: edges.sort((a, b) => `${a.from}:${a.to}:${a.type}`.localeCompare(`${b.from}:${b.to}:${b.type}`)),
  };
}

export function portableWorkspacePath(context: WorkspaceContext, absolutePath: string): string {
  return path.relative(context.workspaceRoot, absolutePath).replace(/\\/g, '/') || '.';
}

function graphNodeRank(node: WorkspaceGraphNode): string {
  const order = node.kind === 'workspace' ? '0' : node.kind === 'repo' ? '1' : node.kind === 'group' ? '2' : node.kind === 'spec' ? '3' : '4';
  return `${order}:${node.id}`;
}

export function repoQualifiedPath(repoAlias: string, filePath: string): string {
  return `${repoAlias}:${filePath.replace(/\\/g, '/')}`;
}
