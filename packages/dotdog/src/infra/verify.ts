// infra/verify.ts — parse Infrastructure blocks from .dog files, verify cloud resources
// Dispatches to provider-specific verifiers. Zero credential exposure.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
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

  function scan(d: string) {
    const { readdirSync } = require('fs');
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) { scan(p); continue; }
      if (!entry.name.endsWith('.dog')) continue;

      try {
        const content = readFileSync(p, 'utf-8');
        const ast = parse(content);

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
      } catch { /* skip unparseable files */ }
    }
  }

  scan(dir);
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

  if (opts.providerFilter) {
    const pf = opts.providerFilter.toLowerCase();
    const filtered = resources.filter(r => r.provider.toLowerCase() === pf);
    if (filtered.length === 0) {
      return [{
        entity: '', provider: opts.providerFilter, resource: '',
        status: 'skip', message: `No ${opts.providerFilter} resources found in specs`,
      }];
    }
    return runChecks(filtered, opts);
  }

  if (opts.entityFilter) {
    const ef = opts.entityFilter.toLowerCase();
    const filtered = resources.filter(r => r.entity.toLowerCase() === ef);
    if (filtered.length === 0) {
      return [{
        entity: opts.entityFilter, provider: '', resource: '',
        status: 'skip', message: `No entity "${opts.entityFilter}" has infrastructure mappings`,
      }];
    }
    return runChecks(filtered, opts);
  }

  if (resources.length === 0) {
    return [{
      entity: '', provider: '', resource: '',
      status: 'skip',
      message: 'No infrastructure resources found. Add an ### Infrastructure block to a .dog file:\n\n  ### Infrastructure\n  ```yaml\n  resources:\n    - provider: cloudflare\n      resource: r2:my-bucket\n      entity: FileStorage\n  ```',
    }];
  }

  return runChecks(resources, opts);
}

async function runChecks(resources: InfraResource[], _opts: VerifyOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const resource of resources) {
    const provider = providers[resource.provider.toLowerCase()];
    if (!provider) {
      results.push({
        entity: resource.entity, provider: resource.provider, resource: resource.resource,
        status: 'skip', message: `Unknown provider: ${resource.provider}`,
      });
      continue;
    }

    try {
      const result = await provider.verify(resource);
      results.push(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        entity: resource.entity, provider: resource.provider, resource: resource.resource,
        status: 'fail', message: `Error: ${msg}`,
      });
    }
  }

  return results;
}
