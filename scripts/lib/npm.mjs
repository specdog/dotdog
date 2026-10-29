import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';

export function npm(args, options = {}) {
  const candidates = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')];
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    const path = join(directory, process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'npm');
    if (existsSync(path)) candidates.push(realpathSync(path));
  }
  const cli = candidates.find(path => path && path.endsWith('npm-cli.js') && existsSync(path));
  if (!cli) throw new Error('Cannot locate npm-cli.js for the selected Node runtime');
  return execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', ...options });
}
