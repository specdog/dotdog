import type { WorkspaceSelection } from './types';

export function selectionFromOptions(options: { repo?: string; group?: string; workspace?: boolean }): WorkspaceSelection {
  const selected = [Boolean(options.repo), Boolean(options.group), Boolean(options.workspace)].filter(Boolean).length;
  if (selected > 1) throw new Error('Choose only one of --repo, --group, or --workspace.');
  if (options.repo) return { type: 'repo', repo: options.repo };
  if (options.group) return { type: 'group', group: options.group };
  if (options.workspace) return { type: 'workspace' };
  return { type: 'current' };
}

export function assertExplicitMultiRepoSelection(selection: WorkspaceSelection, repoCount: number, commandName: string): void {
  if (repoCount <= 1) return;
  if (selection.type !== 'current') return;

  throw new Error([
    `Refusing to ${commandName} multiple repos implicitly.`,
    '',
    'Use one of:',
    `  dotdog ${commandName} --repo <alias>`,
    `  dotdog ${commandName} --group <name>`,
    `  dotdog ${commandName} --workspace`,
  ].join('\n'));
}
