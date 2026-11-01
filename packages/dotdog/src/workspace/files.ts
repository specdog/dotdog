import { closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { safeOutputPath, realPath } from './paths';

const locks = new Map<string, string>();

export function atomicWrite(root: string, file: string, data: string | Uint8Array, mode?: number) {
  const target = safeOutputPath(file, root);
  if (existsSync(target) && !statSync(target).isFile()) throw new Error(`Output is not a regular file: ${target}`);
  mkdirSync(dirname(target), { recursive: true });
  const directory = mkdtempSync(join(dirname(target), '.dotdog-write-'));
  const temporary = join(directory, 'output');
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, 'wx', mode ?? (existsSync(target) ? statSync(target).mode & 0o777 : 0o600));
    writeFileSync(descriptor, data);
    fsyncSync(descriptor);
    closeSync(descriptor); descriptor = undefined;
    safeOutputPath(file, root);
    renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(directory, { recursive: true, force: true });
  }
}

export function lockEnvironment(root: string) {
  const token = locks.get(realPath(root));
  return token ? { DOTDOG_REFRESH_TOKEN: token } : {};
}

export function withRepoLock<T>(root: string, action: () => T): T {
  root = realPath(root);
  if (locks.has(root)) return action();
  const file = safeOutputPath('.doghouse/refresh.lock', root);
  const guard = safeOutputPath('.doghouse/refresh.guard', root);
  mkdirSync(dirname(file), { recursive: true });
  let guardDescriptor: number;
  try { guardDescriptor = openSync(guard, 'wx', 0o600); }
  catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('Repository graph write is already in progress; retry. If interrupted during acquisition, inspect .doghouse/refresh.guard.');
  }
  let owner = JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() }), inherited = false;
  let descriptor: number | undefined;
  try {
    if (existsSync(file)) {
      let previous: any;
      try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('Cannot verify refresh lock owner; inspect .doghouse/refresh.lock before removing it'); }
      inherited = previous.pid === process.ppid && previous.host === hostname() && previous.token === process.env.DOTDOG_REFRESH_TOKEN;
      if (inherited) owner = JSON.stringify(previous);
      else {
        if (!Number.isInteger(previous.pid) || previous.pid <= 0 || previous.host !== hostname()) throw new Error('Cannot verify refresh lock owner; preserve the lock for inspection');
        let dead = false;
        try { process.kill(previous.pid, 0); } catch (error: any) { if (error.code === 'ESRCH') dead = true; }
        if (!dead) throw new Error('Repository graph write is already in progress; retry after it finishes');
        unlinkSync(file);
      }
    }
    if (!inherited) {
      descriptor = openSync(file, 'wx', 0o600);
      writeFileSync(descriptor, owner); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    closeSync(guardDescriptor);
    unlinkSync(guard);
  }
  locks.set(root, JSON.parse(owner).token);
  try { return action(); }
  finally {
    locks.delete(root);
    if (!inherited && existsSync(file) && readFileSync(file, 'utf8') === owner) unlinkSync(file);
  }
}
