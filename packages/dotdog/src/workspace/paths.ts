import { existsSync, realpathSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const SECRET_FILE_PATTERNS = [
  /^\.env(?:\..*)?$/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.crt$/i,
  /^id_rsa$/,
  /^id_ed25519$/,
];

const IGNORED_DIRS = new Set([
  '.aws',
  '.azure',
  '.cache',
  '.gcp',
  '.git',
  '.next',
  '.ssh',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

export function expandHome(inputPath: string): string {
  if (inputPath === '~') return homedir();
  if (inputPath.startsWith('~/')) return path.join(homedir(), inputPath.slice(2));
  return inputPath;
}

export function realPath(inputPath: string): string {
  return realpathSync.native(inputPath);
}

export function isInsideRoot(targetPath: string, rootPath: string): boolean {
  const target = realPath(targetPath);
  const root = realPath(rootPath);
  return target === root || target.startsWith(root + path.sep);
}

export function assertInsideRoots(targetPath: string, roots: string[]): void {
  if (!existsSync(targetPath)) {
    throw new Error(`Path does not exist: ${targetPath}`);
  }

  if (!roots.some((root) => isInsideRoot(targetPath, root))) {
    throw new Error(`Path outside allowed roots: ${targetPath}`);
  }
}

export function resolveUserPath(inputPath: string, rootPath = process.cwd()): string {
  const expanded = expandHome(inputPath);
  const root = realPath(rootPath);
  const resolved = path.resolve(root, expanded);

  if (!existsSync(resolved)) {
    const parent = path.dirname(resolved);
    assertInsideRoots(parent, [root]);
    return resolved;
  }

  assertInsideRoots(resolved, [root]);
  return realPath(resolved);
}

export function isIgnoredRepoPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => IGNORED_DIRS.has(part))) return true;
  const basename = parts[parts.length - 1] || normalized;
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}
