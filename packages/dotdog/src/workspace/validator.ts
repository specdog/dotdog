import { existsSync, statSync } from 'fs';
import path from 'path';
import type { ValidationIssue, ValidationResult, WorkspaceConfig } from './types';

const SAFE_ALIAS = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

function issue(code: string, message: string, fieldPath?: string): ValidationIssue {
  return { code, message, path: fieldPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function validateWorkspaceConfig(
  input: unknown,
  options: { manifestDir?: string; checkPaths?: boolean; allowDuplicatePaths?: boolean } = {},
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: [issue('invalid_config', 'Workspace config must be an object.')], warnings };
  }

  const config = input as WorkspaceConfig;
  if (config.version !== 1) errors.push(issue('invalid_version', 'Only workspace manifest version 1 is supported.', 'version'));
  if (!isRecord(config.workspace)) errors.push(issue('missing_workspace', 'workspace is required.', 'workspace'));
  if (!config.workspace?.id || typeof config.workspace.id !== 'string') errors.push(issue('missing_workspace_id', 'workspace.id is required.', 'workspace.id'));
  if (!Array.isArray(config.repos) || config.repos.length === 0) errors.push(issue('missing_repos', 'At least one repo is required.', 'repos'));

  const aliases = new Set<string>();
  const paths = new Set<string>();

  for (const [index, repo] of (Array.isArray(config.repos) ? config.repos : []).entries()) {
    const base = `repos[${index}]`;
    if (!repo.alias || typeof repo.alias !== 'string' || !SAFE_ALIAS.test(repo.alias)) {
      errors.push(issue('invalid_repo_alias', `Invalid repo alias: ${String(repo.alias || '')}`, `${base}.alias`));
    }
    if (repo.alias && aliases.has(repo.alias)) errors.push(issue('duplicate_repo_alias', `Duplicate repo alias: ${repo.alias}`, `${base}.alias`));
    if (repo.alias) aliases.add(repo.alias);

    if (!repo.path || typeof repo.path !== 'string') {
      errors.push(issue('missing_repo_path', `Repo path is required for ${repo.alias || base}.`, `${base}.path`));
      continue;
    }

    if (repo.path.includes('\0')) errors.push(issue('unsafe_path', `Repo path contains a control character: ${repo.path}`, `${base}.path`));

    if (options.manifestDir) {
      const resolved = path.resolve(options.manifestDir, repo.path);
      if (!options.allowDuplicatePaths && paths.has(resolved)) errors.push(issue('duplicate_repo_path', `Duplicate repo path: ${repo.path}`, `${base}.path`));
      paths.add(resolved);

      if (options.checkPaths) {
        if (!existsSync(resolved)) errors.push(issue('repo_path_not_found', `Repo path not found: ${repo.path}`, `${base}.path`));
        else if (!statSync(resolved).isDirectory()) errors.push(issue('repo_path_not_directory', `Repo path is not a directory: ${repo.path}`, `${base}.path`));
      }
    }
  }

  const groupNames = new Set<string>();
  for (const [index, group] of (config.groups || []).entries()) {
    const base = `groups[${index}]`;
    if (!group.name) errors.push(issue('missing_group_name', 'Group name is required.', `${base}.name`));
    if (group.name && groupNames.has(group.name)) errors.push(issue('duplicate_group_name', `Duplicate group name: ${group.name}`, `${base}.name`));
    if (group.name) groupNames.add(group.name);
    for (const alias of group.repos || []) {
      if (!aliases.has(alias)) errors.push(issue('unknown_group_repo', `Group "${group.name}" references unknown repo "${alias}".`, `${base}.repos`));
    }
  }

  for (const [index, edge] of (config.edges || []).entries()) {
    const base = `edges[${index}]`;
    if (!aliases.has(edge.from)) errors.push(issue('unknown_edge_from', `Edge references unknown source repo "${edge.from}".`, `${base}.from`));
    if (!aliases.has(edge.to)) errors.push(issue('unknown_edge_to', `Edge references unknown target repo "${edge.to}".`, `${base}.to`));
    if (!edge.type) errors.push(issue('missing_edge_type', `Edge "${edge.from}" -> "${edge.to}" is missing type.`, `${base}.type`));
  }

  return { valid: errors.length === 0, errors, warnings };
}
