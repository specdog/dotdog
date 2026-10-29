// infra/verify.ts — parse Infrastructure blocks from .dog files, verify cloud resources
// Dispatches to explicit read-only provider checks; output redaction is best-effort.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { listRepoFiles } from '../map/repoMapper';
import { resolveUserPath } from '../workspace/paths';
import { redactSecrets } from '../workspace/redact';
import { parse } from '../parser';
import type { InfraResource, CheckResult, Provider } from './providers/types';
import { cloudflareProvider } from './providers/cloudflare';
import { supabaseProvider } from './providers/supabase';
import { vercelProvider } from './providers/vercel';
import { netlifyProvider } from './providers/netlify';
import { railwayProvider } from './providers/railway';
import { awsProvider } from './providers/aws';

// --- Provider registry ---

const providers: Record<string, Provider> = {
  cloudflare: cloudflareProvider,
  supabase: supabaseProvider,
  vercel: vercelProvider,
  netlify: netlifyProvider,
  railway: railwayProvider,
  aws: awsProvider,
};

// --- Simple YAML parse for Infrastructure blocks ---
// We write our own to avoid adding js-yaml dep. Handles the subset dotdog uses.

function parseSimpleYAML(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentList: Record<string, unknown>[] = [];
  let inList = false;

  for (const raw of lines) {
    const trimmed = raw.trimEnd();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;

    const matchKV = trimmed.match(/^(\w[\w_-]*):\s*(.*)/);
    const leading = raw.length - raw.trimStart().length;

    if (leading === 0 && matchKV && !trimmed.startsWith('-')) {
      // Top-level key
      if (inList) { result[currentKey] = currentList; inList = false; currentList = []; }
      currentKey = matchKV[1];
      const val = matchKV[2].trim();
      if (val === '') continue; // nested — value follows
      if (val === 'true') { result[currentKey] = true; continue; }
      if (val === 'false') { result[currentKey] = false; continue; }
      const num = Number(val);
      if (!isNaN(num) && val !== '') { result[currentKey] = num; continue; }
      result[currentKey] = val.replace(/^['"]|['"]$/g, '');
      continue;
    }

    // Check for list item (may have leading whitespace)
    const trimmedStart = trimmed.trimStart();
    if (trimmedStart.startsWith('- ')) {
      // New list item
      if (!inList) { currentList = []; inList = true; }
      const item = trimmedStart.slice(2).trim();
      const kvMatch = item.match(/^(\w[\w_-]*):\s*(.*)/);
      if (kvMatch) {
        const obj: Record<string, unknown> = {};
        obj[kvMatch[1]] = parseYamlValue(kvMatch[2]);
        currentList.push(obj);
      } else {
        currentList.push({ _value: item } as unknown as Record<string, unknown>);
      }
      continue;
    }

    if (leading > 0 && inList && currentList.length > 0) {
      // Nested property inside a list item — strip leading whitespace for regex
      const stripped = trimmed.trimStart();
      const nestedMatch = stripped.match(/^(\w[\w_-]*):\s*(.*)/);
      if (nestedMatch) {
        const last = currentList[currentList.length - 1];
        const val = parseYamlValue(nestedMatch[2]);
        if (nestedMatch[1] === 'tables' && typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
          last[nestedMatch[1]] = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          last[nestedMatch[1]] = val;
        }
      }
      continue;
    }
  }

  if (inList) result[currentKey] = currentList;
  return result;
}

function parseYamlValue(val: string): unknown {
  const v = val.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  const num = Number(v);
  if (!isNaN(num) && v !== '') return num;
  return v.replace(/^['"]|['"]$/g, '');
}

// --- Parse Infrastructure blocks from .dog files ---

function parseInfraBlock(yamlContent: string): InfraResource[] {
  const lines = yamlContent.split('\n');
  const parsed = parseSimpleYAML(lines);
  const resources = parsed.resources;
  if (!Array.isArray(resources)) return [];

  return resources.map((r: unknown) => {
    const item = r as Record<string, unknown>;
    const tables = item.tables;
    return {
      provider: String(item.provider || ''),
      resource: String(item.resource || ''),
      entity: String(item.entity || ''),
      region: item.region ? String(item.region) : undefined,
      tables: Array.isArray(tables) ? tables.map(String) : undefined,
    };
  }).filter(r => r.provider && r.resource && r.entity);
}

function findInfraResources(dir: string): InfraResource[] {
  const resources: InfraResource[] = [];

  for (const file of listRepoFiles(dir).filter(file => file.endsWith('.dog'))) {
      const p = resolveUserPath(file, dir);
      try {
        const content = readFileSync(p, 'utf-8');
        const ast = parse(content);
        if (ast.errors.length) throw new Error(ast.errors.map(error => error.message).join('; '));

        // Look for ### Infrastructure sections with YAML blocks
        for (const section of ast.sections) {
          if (section.heading.toLowerCase().includes('infrastructure')) {
            // Find YAML blocks in this section
            const yamlBlocks = section.blocks.filter(b => {
              if (b.kind !== 'prose') return false;
              const c = (b as { content: string }).content;
              return c.includes('resources:') || c.includes('provider:');
            });

            for (const block of yamlBlocks) {
              const content = (block as { content: string }).content;
              // Strip markdown code fences
              const clean = content.replace(/^```(yaml)?\n?/gm, '').replace(/```$/gm, '');
              const found = parseInfraBlock(clean);
              resources.push(...found);
            }
          }

          // Also check for infra entities: type: infrastructure
          for (const block of section.blocks) {
            if (block.kind === 'entity' && (block as { type?: string }).type === 'infrastructure') {
              const e = block as { name: string; type: string; properties: Record<string, { default?: unknown }> };
              const provider = e.properties?.provider?.default as string;
              const resource = e.properties?.resource?.default as string;
              if (provider && resource) {
                resources.push({
                  provider,
                  resource,
                  entity: e.name,
                  region: e.properties?.region?.default as string | undefined,
                  tables: e.properties?.tables?.default as string[] | undefined,
                });
              }
            }
          }
        }
      } catch (error) { throw new Error(`Cannot inspect infrastructure in ${file}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return resources;
}

// --- Main verify ---

export interface VerifyOptions {
  dir: string;
  providerFilter?: string;
  entityFilter?: string;
}

export async function verifyInfra(opts: VerifyOptions): Promise<CheckResult[]> {
  const resources = findInfraResources(opts.dir);

  const filtered = resources.filter(resource => (!opts.providerFilter || resource.provider.toLowerCase() === opts.providerFilter.toLowerCase()) && (!opts.entityFilter || resource.entity.toLowerCase() === opts.entityFilter.toLowerCase()));
  if ((opts.providerFilter || opts.entityFilter) && !filtered.length) return [{ entity: opts.entityFilter || '', provider: opts.providerFilter || '', resource: '', status: 'skip', message: 'No infrastructure mappings match all filters' }];
  if (resources.length === 0) {
    return [{
      entity: '', provider: '', resource: '',
      status: 'skip',
      message: 'No infrastructure resources found. Add an ### Infrastructure block to a .dog file:\n\n  ### Infrastructure\n  ```yaml\n  resources:\n    - provider: cloudflare\n      resource: r2:my-bucket\n      entity: FileStorage\n  ```',
    }];
  }

  return verifyInfraResources(filtered);
}

function redactCheck(result: CheckResult): CheckResult {
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, typeof value === 'string' ? redactSecrets(value) : key === 'children' && Array.isArray(value) ? value.map(redactCheck) : value])) as unknown as CheckResult;
}

export async function verifyInfraResources(resources: InfraResource[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const resource of resources) {
    const provider = Object.hasOwn(providers, resource.provider.toLowerCase()) ? providers[resource.provider.toLowerCase()] : undefined;
    if (!provider) {
      results.push({
        entity: resource.entity, provider: resource.provider, resource: resource.resource,
        status: 'skip', message: `Unknown provider: ${resource.provider}`,
      });
      continue;
    }

    try {
      const result = await provider.verify(resource);
      results.push(redactCheck(result));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        entity: resource.entity, provider: resource.provider, resource: resource.resource,
        status: 'fail', message: `Error: ${redactSecrets(msg)}`,
      });
    }
  }

  return results;
}
