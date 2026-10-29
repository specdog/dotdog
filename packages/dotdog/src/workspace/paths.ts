import { existsSync, realpathSync, lstatSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const SECRET_FILE_PATTERNS = [
  /^\.env(?:\..*)?$/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.crt$/i,
  /^\.(npmrc|pypirc|netrc)$/,
  /^(credentials|service[-_]?account)(?:\.[^.]+)?\.json$/i,
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

  let component = resolved;
  while (component !== path.dirname(component)) {
    try {
      if (lstatSync(component).isSymbolicLink() && !existsSync(component)) throw new Error(`Dangling symlink: ${component}`);
    } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    component = path.dirname(component);
  }

  if (!existsSync(resolved)) {
    let parent = path.dirname(resolved);
    while (!existsSync(parent)) parent = path.dirname(parent);
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

export function safeOutputPath(inputPath: string, rootPath = process.cwd()): string {
  const root = realPath(rootPath);
  const expanded = expandHome(inputPath);
  const lexicalRoot = path.resolve(rootPath);
  const absolute = path.resolve(lexicalRoot, expanded);
  const relative = path.relative(lexicalRoot, absolute);
  const resolved = relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) ? path.resolve(root, relative) : absolute;
  resolveUserPath(resolved, root);
  let current = resolved;
  while (current !== path.dirname(current)) {
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symlinked output: ${current}`); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (current === root) break;
    current = path.dirname(current);
  }
  return resolved;
}
