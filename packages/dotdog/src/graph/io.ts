import { readFileSync, statSync } from 'fs';

export const MAX_GRAPH_BYTES = 32 * 1024 * 1024;
export function readGraphText(file: string): string {
  const stat = statSync(file);
  if (!stat.isFile()) throw new Error('Graph input must be a regular file');
  if (stat.size > MAX_GRAPH_BYTES) throw new Error('Graph input exceeds 32 MiB');
  return readFileSync(file, 'utf8');
}
