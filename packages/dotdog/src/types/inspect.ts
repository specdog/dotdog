import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { relative } from 'path';
import type { Command } from 'commander';
import { normalizeGraph } from '../graph/model';
import { minimalChildEnv } from '../workspace/environment';
import { isIgnoredRepoPath, realPath, resolveUserPath } from '../workspace/paths';

export async function inspectTypes(root: string, name: string, file: string, project: string, timeoutMs = 30000): Promise<any> {
  const failure = (error: string) => ({ ok: false, error, nodes: [], edges: [], coverage: { status: 'unknown', scope: 'selected TypeScript contract' }, limitations: ['No requirement or runtime-behavior proof.'] });
  let request: string;
  try {
    root = realPath(root);
    if (!name || name.length > 256 || /[\x00-\x1f\x7f]/.test(name) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) return failure('invalid_request');
    const source = resolveUserPath(file, root), config = resolveUserPath(project, root);
    if (isIgnoredRepoPath(relative(root, source)) || isIgnoredRepoPath(relative(root, config))) return failure('invalid_request');
    request = JSON.stringify({ root, name, file: source, project: config });
    if (Buffer.byteLength(request) > 65536) return failure('invalid_request');
  } catch { return failure('invalid_request'); }
  const worker = [new URL('./types/type-worker.js', import.meta.url), new URL('../../dist/types/type-worker.js', import.meta.url)].find(url => existsSync(url));
  if (!worker) return failure('worker_missing_build_required');
  return new Promise(resolve => {
    const child = spawn(process.versions.bun ? 'node' : process.execPath, [fileURLToPath(worker)], { cwd: root, env: minimalChildEnv(), detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', bytes = 0, reason = '';
    const stop = (error: string) => {
      if (reason) return;
      reason = error;
      if (!child.pid) return;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000, env: minimalChildEnv() });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => stop('compiler_timeout'), timeoutMs);
    const cancel = () => { process.exitCode = 130; stop('cancelled'); };
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    const cleanup = () => { clearTimeout(timer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { bytes += Buffer.byteLength(chunk); if (bytes > 1024 * 1024) stop('compiler_output_limit'); else output += chunk; });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 1024 * 1024) stop('compiler_output_limit'); });
    child.stdin.on('error', () => {});
    child.on('error', () => { cleanup(); resolve(failure('compiler_runtime_unavailable')); });
    child.on('close', code => {
      cleanup();
      if (reason) { resolve(failure(reason)); return; }
      try {
        const result = JSON.parse(output);
        if (code !== 0 || result.ok !== true) {
          const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 100).filter((item: any) => Number.isInteger(item?.code)).map((item: any) => ({ code: item.code })) : [];
          resolve({ ...failure(typeof result.error === 'string' && /^[a-z_]+$/.test(result.error) ? result.error : 'compiler_failed'), diagnostics }); return;
        }
        resolve({ ...result, ...normalizeGraph(result) });
      } catch { resolve(failure('compiler_failed')); }
    });
    child.stdin.end(request);
  });
}

export function registerTypeCommands(program: Command) {
  program.command('types').description('Opt-in selected TypeScript contracts; uses a trusted project-installed compiler')
    .command('inspect <export>').requiredOption('--file <path>').requiredOption('--project <tsconfig>').option('--json')
    .action(async (name, options) => {
      const result = await inspectTypes(process.cwd(), name, options.file, options.project);
      if (!result.ok) process.exitCode ||= 1;
      console.log(options.json ? JSON.stringify(result) : result.ok ? `${result.nodes.length} graph nodes; selected type coverage is partial` : `Type inspection failed: ${result.error}`);
    });
}
