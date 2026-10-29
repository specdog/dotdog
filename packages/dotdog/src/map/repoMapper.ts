import { atomicWrite } from '../workspace/files';
import { existsSync, mkdirSync, readdirSync, readFileSync, lstatSync } from 'fs';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mapSource } from './source';
import { join, basename } from 'path';
import { renderRepositoryDag } from '../dag/repoWorld';
import { stableId } from '../dag/schema';
import { isIgnoredRepoPath, resolveUserPath, safeOutputPath } from '../workspace/paths';

const extractorKey = `${require('../../package.json').version}:${require('@babel/parser/package.json').version}:source-v2`;

export type RepoMapFact = {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, string>;
};

export type RepoMapEdge = {
  source: string;
  target: string;
  verb: string;
  cardinality?: string;
};

export type GraphFact = {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  repo?: string;
  file?: string;
  line?: number;
  confidence: 'explicit' | 'compiled' | 'inferred';
  source: 'spec' | 'code' | 'manifest' | 'package';
};

export type RepoMap = {
  facts: RepoMapFact[];
  edges: RepoMapEdge[];
  files: string[];
  limitations?: string[];
};

export type RepoMapWriteResult = {
  file: string;
  dagFile: string;
  factsFile: string;
  facts: number;
  edges: number;
  observedFacts: number;
  scanned: number;
};

const REPO_MAP_IGNORES = new Set([
  '.git',
  '.doghouse',
  'target',
  '.venv',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.turbo',
  '.cache',
  '.vercel',
  '.parcel-cache',
]);

export function safeProjectName(dir: string): string {
  const base = basename(dir) || 'project';
  return base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

export function listRepoFiles(root: string): string[] {
  if (existsSync(join(root, '.git'))) {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
    return [...new Set(files)].filter(file => !file.split('/').some(part => REPO_MAP_IGNORES.has(part)) && !isIgnoredRepoPath(file) && existsSync(join(root, file)) && lstatSync(join(root, file)).isFile() && (() => { try { safeOutputPath(file, root); return true; } catch { return false; } })()).sort();
  }
  const out: string[] = [];

  function walk(current: string, rel = '') {

    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
    try {
      entries = readdirSync(current, { withFileTypes: true }) as typeof entries;
    } catch (error) { throw new Error(`Cannot scan ${rel || '.'}: ${error instanceof Error ? error.message : String(error)}`); }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (REPO_MAP_IGNORES.has(entry.name)) continue;

      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isIgnoredRepoPath(nextRel)) continue;
      const nextPath = join(current, entry.name);

      if (entry.isDirectory()) walk(nextPath, nextRel);
      else if (entry.isFile()) out.push(nextRel);
    }
  }

  walk(root);
  return out;
}

function fileNodeName(file: string): string {
  return `file:${file}`;
}

function routeFromFile(file: string): string | null {
  const normalized = file.replace(/\\/g, '/');
  if (/(?:^|\/)app\/page\.(?:ts|tsx|js|jsx)$/.test(normalized) || /(?:^|\/)pages\/index\.(?:ts|tsx|js|jsx|mdx)$/.test(normalized)) return '/';
  const api = normalized.match(/(?:^|\/)(?:app|pages)\/api\/(.+?)\.(?:ts|tsx|js|jsx)$/);
  if (api) return `/api/${api[1].replace(/\/route$/, '').replace(/\/index$/, '').replace(/\[[^\]]+\]/g, ':param')}`;

  const appRoute = normalized.match(/(?:^|\/)app\/(.+?)\/(?:page|route)\.(?:ts|tsx|js|jsx)$/);
  if (appRoute) return `/${appRoute[1].replace(/\([^)]*\)\//g, '').replace(/\/index$/, '').replace(/\[[^\]]+\]/g, ':param')}`.replace(/\/\/+/g, '/');

  const pageRoute = normalized.match(/(?:^|\/)pages\/(.+?)\.(?:ts|tsx|js|jsx|mdx)$/);
  if (pageRoute && !pageRoute[1].startsWith('api/')) return `/${pageRoute[1].replace(/\/index$/, '').replace(/\[[^\]]+\]/g, ':param')}`.replace(/\/\/+/g, '/');

  return null;
}

export function detectRepoMap(root: string, cache?: Record<string, any>): RepoMap {
  const files = listRepoFiles(root);
  const fileSet = new Set(files);
  const limitations: string[] = ['JS/TS extraction covers top-level declarations and static relative imports/re-exports; dynamic calls and package alias resolution are not inferred.'];
  const facts = new Map<string, RepoMapFact>();
  const inventoryHash = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  const hashes = new Map(files.map(file => [file, createHash('sha256').update(readFileSync(join(root, file))).digest('hex')]));
  const edges: RepoMapEdge[] = [];
  const addFact = (fact: RepoMapFact) => { if (!facts.has(fact.name) || facts.get(fact.name)!.type === 'file') facts.set(fact.name, fact); };
  const addFile = (file: string, type = 'file', description = file) => addFact({ name: fileNodeName(file), type, description, properties: { path: file } });
  const addDeploymentProvider = (file: string, name: string, provider: string) => {
    addFile(file, 'deployment_config', provider + ' deployment configuration');
    addFact({ name: 'Deployment', type: 'external', description: 'Detected deployment capability', properties: { required: 'false' } });
    addFact({ name, type: 'external', description: provider + ' deployment service', properties: { provider, required: 'false' } });
    edges.push({ source: 'Deployment', target: name, verb: 'includes' });
    edges.push({ source: name, target: fileNodeName(file), verb: 'configured_by' });
  };

  addFact({ name: 'repository', type: 'repo', description: 'Mapped repository' });

  for (const file of files) addFile(file);

  for (const file of files) {
    if (file === 'railway.json' || file.endsWith('/railway.json')) {
      addDeploymentProvider(file, 'RailwayService', 'railway');
      continue;
    }

    if (file === 'vercel.json' || file.endsWith('/vercel.json') || file === '.vercel/project.json') {
      addDeploymentProvider(file, 'VercelApp', 'vercel');
      continue;
    }

    if (file === 'netlify.toml' || file.endsWith('/netlify.toml')) {
      addDeploymentProvider(file, 'NetlifySite', 'netlify');
      continue;
    }

    if (file === 'package.json') {
      addFile(file, 'manifest', 'Node package manifest');
      edges.push({ source: 'repository', target: fileNodeName(file), verb: 'configured_by' });
      try {
        const pkg = JSON.parse(readFileSync(join(root, file), 'utf-8'));
        if (pkg.name) addFact({ name: `package:${pkg.name}`, type: 'package', description: pkg.description || pkg.name, properties: { version: String(pkg.version || '') } });
        if (pkg.name) edges.push({ source: fileNodeName(file), target: `package:${pkg.name}`, verb: 'defines' });
      } catch {}
      continue;
    }

    if (/^(bun\.lockb?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) {
      addFile(file, 'lockfile', 'Package manager lockfile');
      edges.push({ source: 'repository', target: fileNodeName(file), verb: 'configured_by' });
      continue;
    }

    if ((file.startsWith('.github/workflows/') && file.endsWith('.yml')) || (file.startsWith('.github/workflows/') && file.endsWith('.yaml'))) {
      addFile(file, 'ci_workflow', 'GitHub Actions workflow');
      edges.push({ source: fileNodeName(file), target: 'repository', verb: 'deployed_by' });
      continue;
    }

    if (/(^|\/)(test|tests|__tests__)\//.test(file) || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file)) {
      addFile(file, 'test', 'Test file');
      edges.push({ source: fileNodeName(file), target: 'repository', verb: 'tested_by' });
      continue;
    }

    if (/\.(env|env\.example|env\.local|env\.sample)$/.test(file) || file.includes('.env')) {
      continue;
    }

    const route = routeFromFile(file);
    if (route) {
      addFile(file, file.includes('/api/') || file.endsWith('/route.ts') || file.endsWith('/route.js') ? 'api_route' : 'page_route', `Route ${route}`);
      addFact({ name: `route:${route}`, type: route.startsWith('/api/') ? 'api_route' : 'page_route', description: route });
      edges.push({ source: fileNodeName(file), target: `route:${route}`, verb: 'implements' });
      continue;
    }

    if (/\.(tsx|jsx)$/.test(file) && /(^|\/)(components?|ui)\//.test(file)) {
      addFile(file, 'component', 'Frontend component');
      edges.push({ source: fileNodeName(file), target: 'repository', verb: 'owned_by' });
      continue;
    }

    if (/(prisma\/schema\.prisma|migrations?\/|drizzle\.config\.)/.test(file)) {
      addFile(file, 'schema', 'Database schema or migration');
      edges.push({ source: fileNodeName(file), target: 'repository', verb: 'defines' });
      continue;
    }

    if (/^(README|AGENTS|CLAUDE|CONTRIBUTING|SECURITY|CHANGELOG|LICENSE)/i.test(file) || file.endsWith('.md')) {
      addFile(file, 'doc', 'Documentation');
      edges.push({ source: fileNodeName(file), target: 'repository', verb: 'documented_by' });
    }
  }

  for (const file of files.filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
    const key = `${hashes.get(file)}:${inventoryHash}:${extractorKey}`;
    const mapped = cache?.[file]?.key === key ? cache[file].mapped : mapSource(file, readFileSync(join(root, file), 'utf8'), fileSet);
    if (cache) cache[file] = { key, mapped };
    for (const fact of mapped.facts) addFact(fact);
    edges.push(...mapped.edges); limitations.push(...mapped.limitations);
  }
  for (const fact of facts.values()) {
    const path = fact.properties?.path;
    if (path) fact.properties = { ...fact.properties, sha256: hashes.get(path)! };
  }
  return { facts: [...facts.values()], edges: [...new Map(edges.map(edge => [`${edge.source}\0${edge.verb}\0${edge.target}`, edge])).values()], files, limitations };
}

function dogString(value: string): string {
  return String(value).replace(/`/g, "'").replace(/[\r\n]/g, " ").trim();
}

function graphFactSource(fact: RepoMapFact): GraphFact['source'] {
  if (fact.type === 'package') return 'package';
  if (fact.type === 'manifest' || fact.type === 'lockfile' || fact.type === 'deployment_config') return 'manifest';
  return 'code';
}

export function toGraphFacts(map: RepoMap, repo?: string): GraphFact[] {
  const facts: GraphFact[] = [];

  for (const fact of map.facts) {
    const file = fact.properties?.path;
    facts.push({
      id: stableId('fact', repo || 'repo', fact.name, 'is', fact.type),
      subject: fact.name,
      predicate: 'is',
      object: fact.type,
      ...(repo ? { repo } : {}),
      ...(file ? { file } : {}),
      confidence: 'compiled',
      source: graphFactSource(fact),
    });
  }

  for (const edge of map.edges) {
    facts.push({
      id: stableId('fact', repo || 'repo', edge.source, edge.verb, edge.target),
      subject: edge.source,
      predicate: edge.verb,
      object: edge.target,
      ...(repo ? { repo } : {}),
      confidence: 'compiled',
      source: 'code',
    });
  }

  return facts.sort((a, b) => a.id.localeCompare(b.id));
}

export function renderGraphFactsJsonl(facts: GraphFact[]): string {
  return facts.map((fact) => JSON.stringify(fact)).join('\n') + (facts.length ? '\n' : '');
}

export function renderRepoMapDog(project: string, root: string, map: RepoMap): string {
  const lines: string[] = [];
  lines.push('# Repo Map');
  lines.push('');
  lines.push(`> Generated by dotdog map. Project: ${project}. Source: repository root.`);
  lines.push('');
  lines.push('## Implementation Map');
  lines.push('');

  for (const fact of map.facts) {
    lines.push(`### Entity: ${dogString(fact.name)}`);
    lines.push('');
    lines.push(dogString(fact.description));
    lines.push('');
    lines.push('```yaml');
    lines.push(`entity: ${dogString(fact.name)}`);
    lines.push(`type: ${dogString(fact.type)}`);
    if (fact.properties && Object.keys(fact.properties).length) {
      lines.push('properties:');
      for (const [key, value] of Object.entries(fact.properties)) {
        lines.push(`  ${key}:`);
        lines.push('    type: string');
        lines.push(`    default: ${dogString(value)}`);
      }
    }
    lines.push('```');
    lines.push('');
  }

  for (const edge of map.edges) {
    lines.push(`### Relationship: ${dogString(edge.source)} → ${dogString(edge.target)}`);
    lines.push('');
    lines.push('```yaml');
    lines.push(`relationship: ${dogString(edge.source)} → ${dogString(edge.target)}`);
    lines.push(`source: ${dogString(edge.source)}`);
    lines.push(`target: ${dogString(edge.target)}`);
    lines.push(`verb: ${dogString(edge.verb)}`);
    lines.push(`cardinality: ${edge.cardinality || 'N:1'}`);
    lines.push('required: false');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function writeRepoMap(targetDir: string, projectName: string, specDir: string): RepoMapWriteResult {
  safeOutputPath(specDir, targetDir);
  for (const file of ['repo-map.dog', 'repo.dag', 'facts.jsonl']) safeOutputPath(join(specDir, file), targetDir);
  const cacheDir = resolveUserPath('.doghouse/cache', targetDir), cacheFile = join(cacheDir, 'sources.json');
  safeOutputPath(cacheFile, targetDir);
  let cache: Record<string, any> = {};
  try { cache = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch {}
  const map = detectRepoMap(targetDir, cache);
  const current = new Set(map.files);
  for (const file of Object.keys(cache)) if (!current.has(file)) delete cache[file];
  mkdirSync(cacheDir, { recursive: true });
  atomicWrite(targetDir, cacheFile, JSON.stringify(cache));
  mkdirSync(specDir, { recursive: true });

  const outFile = join(specDir, 'repo-map.dog');
  const dagFile = join(specDir, 'repo.dag');
  const factsFile = join(specDir, 'facts.jsonl');
  const observedFacts = toGraphFacts(map, projectName);

  atomicWrite(targetDir, outFile, renderRepoMapDog(projectName, targetDir, map));
  atomicWrite(targetDir, dagFile, renderRepositoryDag(projectName, targetDir, map));
  atomicWrite(targetDir, factsFile, renderGraphFactsJsonl(observedFacts));

  return {
    file: outFile,
    dagFile,
    factsFile,
    facts: map.facts.length,
    edges: map.edges.length,
    observedFacts: observedFacts.length,
    scanned: map.files.length,
  };
}
