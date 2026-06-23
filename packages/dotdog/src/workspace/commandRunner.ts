import { spawn } from 'child_process';
import { assertInsideRoots } from './paths';
import { redactSecrets } from './redact';

export interface CommandResult {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; repoRoot?: string; timeoutMs?: number; env?: Record<string, string> },
): Promise<CommandResult> {
  const repoRoot = options.repoRoot || options.cwd;
  assertInsideRoots(options.cwd, [repoRoot]);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs || 30000);

    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({
        command,
        args,
        cwd: options.cwd,
        exitCode,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
      });
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ command, args, cwd: options.cwd, exitCode: 1, stdout: '', stderr: redactSecrets(error.message) });
    });
  });
}
