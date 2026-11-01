import { existsSync, statSync } from 'fs';
import path from 'path';
import type { ValidationIssue, ValidationResult, WorkspaceConfig, WorkspaceParseResult } from './types';

const SAFE_ALIAS = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
type ValidationOptions = { manifestDir?: string; checkPaths?: boolean; allowDuplicatePaths?: boolean };

function issue(code: string, message: string, fieldPath?: string): ValidationIssue {
  return fieldPath === undefined ? { code, message } : { code, message, path: fieldPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function workspaceShape(input: unknown, errors: ValidationIssue[]): input is WorkspaceConfig {
  if (!isRecord(input)) {
    errors.push(issue('invalid_config', 'Workspace config must be an object.'));
    return false;
  }
  const optionalStrings = (record: Record<string, unknown>, keys: string[], base: string) => {
    for (const key of keys) if ((key in record) && typeof record[key] !== 'string') {
      errors.push(issue('invalid_field', `${base}.${key} must be a string when present.`, `${base}.${key}`));
    }
  };
  if (input.version !== 1) errors.push(issue('invalid_version', 'Only workspace manifest version 1 is supported.', 'version'));
  if (!isRecord(input.workspace)) errors.push(issue('missing_workspace', 'workspace must be an object.', 'workspace'));
  else {
    if (!nonempty(input.workspace.id)) errors.push(issue('missing_workspace_id', 'workspace.id is required.', 'workspace.id'));
    optionalStrings(input.workspace, ['name', 'description'], 'workspace');
  }
  if (!Array.isArray(input.repos) || input.repos.length === 0) errors.push(issue('missing_repos', 'At least one repo is required.', 'repos'));
  else for (const [index, repo] of input.repos.entries()) {
    const base = `repos[${index}]`;
    if (!isRecord(repo)) { errors.push(issue('invalid_repo', 'Repo must be an object.', base)); continue; }
    if (!nonempty(repo.alias) || !SAFE_ALIAS.test(repo.alias)) errors.push(issue('invalid_repo_alias', 'Repo alias must be a safe lowercase identifier.', `${base}.alias`));
    if (!nonempty(repo.path)) errors.push(issue('missing_repo_path', 'Repo path is required.', `${base}.path`));
    else if (repo.path.includes('\0')) errors.push(issue('unsafe_path', 'Repo path contains a null character.', `${base}.path`));
    optionalStrings(repo, ['role', 'remote', 'defaultBranch'], base);
    if ('specs' in repo) {
      if (!isRecord(repo.specs)) errors.push(issue('invalid_repo_specs', 'Repo specs must be an object.', `${base}.specs`));
      else {
        optionalStrings(repo.specs, ['path'], `${base}.specs`);
        if (('enabled' in repo.specs) && typeof repo.specs.enabled !== 'boolean') errors.push(issue('invalid_repo_specs', 'Repo specs.enabled must be a boolean.', `${base}.specs.enabled`));
      }
    }
  }
  if ('groups' in input) {
    if (!Array.isArray(input.groups)) errors.push(issue('invalid_groups', 'groups must be an array.', 'groups'));
    else for (const [index, group] of input.groups.entries()) {
      const base = `groups[${index}]`;
      if (!isRecord(group)) { errors.push(issue('invalid_group', 'Group must be an object.', base)); continue; }
      if (!nonempty(group.name)) errors.push(issue('missing_group_name', 'Group name is required.', `${base}.name`));
      if (!Array.isArray(group.repos) || !group.repos.every(nonempty)) errors.push(issue('invalid_group_repos', 'Group repos must be an array of nonempty strings.', `${base}.repos`));
    }
  }
  if ('edges' in input) {
    if (!Array.isArray(input.edges)) errors.push(issue('invalid_edges', 'edges must be an array.', 'edges'));
    else for (const [index, edge] of input.edges.entries()) {
      const base = `edges[${index}]`;
      if (!isRecord(edge)) { errors.push(issue('invalid_edge', 'Edge must be an object.', base)); continue; }
      for (const key of ['from', 'to', 'type']) if (!nonempty(edge[key])) errors.push(issue(`missing_edge_${key}`, `Edge ${key} is required.`, `${base}.${key}`));
      optionalStrings(edge, ['label'], base);
    }
  }
  return errors.length === 0;
}

export function parseWorkspaceConfig(input: unknown, options: ValidationOptions = {}): WorkspaceParseResult {
  const errors: ValidationIssue[] = [], warnings: ValidationIssue[] = [];
  if (!workspaceShape(input, errors)) return { valid: false, errors, warnings };
  const aliases = new Set<string>(), paths = new Set<string>();
  for (const [index, repo] of input.repos.entries()) {
    const base = `repos[${index}]`;
    if (aliases.has(repo.alias)) errors.push(issue('duplicate_repo_alias', `Duplicate repo alias: ${repo.alias}`, `${base}.alias`));
    aliases.add(repo.alias);
    if (options.manifestDir) {
      const resolved = path.resolve(options.manifestDir, repo.path);
      if (!options.allowDuplicatePaths && paths.has(resolved)) errors.push(issue('duplicate_repo_path', `Duplicate repo path: ${repo.path}`, `${base}.path`));
      paths.add(resolved);
      if (options.checkPaths) {
        try {
          if (!existsSync(resolved)) errors.push(issue('repo_path_not_found', `Repo path not found: ${repo.path}`, `${base}.path`));
          else if (!statSync(resolved).isDirectory()) errors.push(issue('repo_path_not_directory', `Repo path is not a directory: ${repo.path}`, `${base}.path`));
        } catch {
          errors.push(issue('repo_path_unreadable', `Cannot inspect repo path: ${repo.path}`, `${base}.path`));
        }
      }
    }
  }
  const groupNames = new Set<string>();
  for (const [index, group] of (input.groups || []).entries()) {
    const base = `groups[${index}]`;
    if (groupNames.has(group.name)) errors.push(issue('duplicate_group_name', `Duplicate group name: ${group.name}`, `${base}.name`));
    groupNames.add(group.name);
    for (const alias of group.repos) if (!aliases.has(alias)) errors.push(issue('unknown_group_repo', `Group "${group.name}" references unknown repo "${alias}".`, `${base}.repos`));
  }
  for (const [index, edge] of (input.edges || []).entries()) {
    const base = `edges[${index}]`;
    if (!aliases.has(edge.from)) errors.push(issue('unknown_edge_from', `Edge references unknown source repo "${edge.from}".`, `${base}.from`));
    if (!aliases.has(edge.to)) errors.push(issue('unknown_edge_to', `Edge references unknown target repo "${edge.to}".`, `${base}.to`));
  }
  return errors.length ? { valid: false, errors, warnings } : { valid: true, data: input, errors, warnings };
}

export function validateWorkspaceConfig(input: unknown, options: ValidationOptions = {}): ValidationResult {
  const { valid, errors, warnings } = parseWorkspaceConfig(input, options);
  return { valid, errors, warnings };
}
