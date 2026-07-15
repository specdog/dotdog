import { createHash, randomBytes } from 'crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';

export type SpecKitFeatureImport = {
  id: string;
  title: string;
  source: string;
  output: string;
  artifacts: string[];
  counts: {
    userStories: number;
    requirements: number;
    successCriteria: number;
    tasks: number;
    entities: number;
  };
};

export type SpecKitImportResult = {
  root: string;
  output: string;
  features: SpecKitFeatureImport[];
  summary: {
    written: number;
    unchanged: number;
    skipped: number;
  };
  actions: Array<{
    path: string;
    status: 'written' | 'unchanged' | 'skipped';
    reason?: string;
  }>;
};

export type SpecKitImportOptions = {
  outputDir?: string;
  force?: boolean;
};

type ImportManifest = {
  version: 1;
  source: 'github-spec-kit';
  output: string;
  files: Record<string, string>;
  features: SpecKitFeatureImport[];
};

type UserStory = { id: string; title: string; priority?: string };
type Requirement = { id: string; description: string };
type Task = { id: string; description: string; completed: boolean; story?: string };
type DomainEntity = { name: string; description: string };
type ArtifactWrite = {
  status: 'written' | 'unchanged' | 'skipped';
  hash?: string;
  reason?: string;
};

function assertSafeSourcePath(root: string, path: string): void {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Spec Kit source must stay inside the project root: ${path}`);
  }

  let current = root;
  for (const part of rel.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) continue;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing symlinked Spec Kit source path: ${current}`);
    }
  }
}

function readSource(root: string, path: string, required = false): string {
  if (!existsSync(path)) {
    if (required) throw new Error(`Missing required Spec Kit artifact: ${path}`);
    return '';
  }
  assertSafeSourcePath(root, path);
  if (!lstatSync(path).isFile()) throw new Error(`Spec Kit artifact is not a regular file: ${path}`);
  return readFileSync(path, 'utf-8');
}

function quoteMarkdown(content: string): string {
  return content
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function importedDocument(title: string, content: string, fallback: string): string {
  const source = content.trim() || fallback.trim();
  if (!source) return '';
  return [`# ${title}`, '', 'Imported source is quoted so it remains documentation rather than executable graph syntax.', '', quoteMarkdown(source), ''].join('\n');
}

function cleanInline(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function entityName(value: string): string {
  const cleaned = cleanInline(value)
    .replace(/[^a-zA-Z0-9 ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Unknown';
}

function featureTitle(spec: string, fallback: string): string {
  const match = spec.match(/^#\s+Feature Specification:\s*(.+)$/m);
  return cleanInline(match?.[1] || fallback);
}

function parseUserStories(spec: string): UserStory[] {
  const stories: UserStory[] = [];
  const pattern = /^###\s+User Story\s+(\d+)\s*-\s*(.+?)(?:\s+\(Priority:\s*(P\d+)\))?\s*$/gm;
  for (const match of spec.matchAll(pattern)) {
    stories.push({ id: `US${match[1]}`, title: cleanInline(match[2]), priority: match[3] });
  }
  return stories;
}

function parseRequirements(spec: string, prefix: 'FR' | 'SC'): Requirement[] {
  const requirements: Requirement[] = [];
  const pattern = new RegExp(`^- \\*\\*(${prefix}-\\d+)\\*\\*:\\s*(.+)$`, 'gm');
  for (const match of spec.matchAll(pattern)) {
    requirements.push({ id: match[1], description: cleanInline(match[2]) });
  }
  return requirements;
}

function parseTasks(tasks: string): Task[] {
  const parsed: Task[] = [];
  const pattern = /^- \[([ xX])\]\s+(T\d+)(?:\s+\[P\])?(?:\s+\[(US\d+)\])?\s+(.+)$/gm;
  for (const match of tasks.matchAll(pattern)) {
    parsed.push({
      id: match[2],
      description: cleanInline(match[4]),
      completed: match[1].toLowerCase() === 'x',
      story: match[3],
    });
  }
  return parsed;
}

function parseDomainEntities(spec: string): DomainEntity[] {
  const section = spec.match(/###\s+Key Entities[^\n]*\n([\s\S]*?)(?=\n##\s|\n###\s|$)/i)?.[1] || '';
  const entities: DomainEntity[] = [];
  const pattern = /^- \*\*([^*]+)\*\*:\s*(.+)$/gm;
  for (const match of section.matchAll(pattern)) {
    entities.push({ name: entityName(match[1]), description: cleanInline(match[2]) });
  }
  return entities;
}

function entityBlock(name: string, type: string, description: string, properties: Record<string, string | boolean> = {}): string {
  const safeDescription = cleanInline(description) || `${name} imported from a Spec Kit artifact.`;
  const lines = [
    `### Entity: ${name}`,
    '',
    `Imported description: ${safeDescription}`,
    '',
    '```yaml',
    `entity: ${name}`,
    `type: ${type}`,
  ];
  if (Object.keys(properties).length) {
    lines.push('properties:');
    for (const [key, value] of Object.entries(properties)) {
      lines.push(`  ${key}:`);
      lines.push(`    type: ${typeof value === 'boolean' ? 'boolean' : 'string'}`);
      lines.push(`    default: ${typeof value === 'boolean' ? String(value) : yamlString(value)}`);
    }
  }
  lines.push('```', '');
  return lines.join('\n');
}

function relationshipBlock(source: string, target: string, verb: string): string {
  return [
    `### Relationship: ${source} → ${target}`,
    '',
    '```yaml',
    `relationship: ${source} → ${target}`,
    `source: ${source}`,
    `target: ${target}`,
    `verb: ${verb}`,
    'cardinality: 1:n',
    'required: false',
    '```',
    '',
  ].join('\n');
}

function buildSpecDog(featureId: string, title: string, sourcePath: string, sourceSpec: string, tasksSource: string): { content: string; counts: SpecKitFeatureImport['counts'] } {
  const stories = parseUserStories(sourceSpec);
  const requirements = parseRequirements(sourceSpec, 'FR');
  const criteria = parseRequirements(sourceSpec, 'SC');
  const tasks = parseTasks(tasksSource);
  const domainEntities = parseDomainEntities(sourceSpec);
  const blocks: string[] = [
    `# Spec Kit Import: ${title}`,
    '',
    '## Imported Graph',
    '',
    entityBlock('Feature', 'speckit-feature', `Spec Kit feature ${title}.`, {
      id: featureId,
      source: sourcePath,
    }),
  ];

  for (const story of stories) {
    blocks.push(entityBlock(story.id, 'user-story', story.title, {
      title: story.title,
      priority: story.priority || '',
    }));
    blocks.push(relationshipBlock('Feature', story.id, 'contains'));
  }

  for (const requirement of requirements) {
    blocks.push(entityBlock(requirement.id, 'requirement', requirement.description, { description: requirement.description }));
    blocks.push(relationshipBlock('Feature', requirement.id, 'requires'));
  }

  for (const criterion of criteria) {
    blocks.push(entityBlock(criterion.id, 'success-criterion', criterion.description, { description: criterion.description }));
    blocks.push(relationshipBlock('Feature', criterion.id, 'measured_by'));
  }

  for (const task of tasks) {
    blocks.push(entityBlock(task.id, 'task', task.description, {
      description: task.description,
      completed: task.completed,
      story: task.story || '',
    }));
    blocks.push(relationshipBlock('Feature', task.id, 'implemented_by'));
    if (task.story && stories.some((story) => story.id === task.story)) {
      blocks.push(relationshipBlock(task.id, task.story, 'delivers'));
    }
  }

  for (const entity of domainEntities) {
    blocks.push(entityBlock(entity.name, 'domain-entity', entity.description, { description: entity.description }));
    blocks.push(relationshipBlock('Feature', entity.name, 'models'));
  }

  blocks.push('## Original Spec Kit Artifact', '', 'Quoted to prevent source Markdown from being interpreted as generated graph syntax.', '', quoteMarkdown(sourceSpec), '');
  return {
    content: blocks.join('\n'),
    counts: {
      userStories: stories.length,
      requirements: requirements.length,
      successCriteria: criteria.length,
      tasks: tasks.length,
      entities: domainEntities.length,
    },
  };
}

function collectContractFiles(root: string, dir: string): string[] {
  if (!existsSync(dir)) return [];
  assertSafeSourcePath(root, dir);
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlinked Spec Kit contract path: ${path}`);
    if (entry.isDirectory()) files.push(...collectContractFiles(root, path));
    else if (entry.isFile() && /\.(md|ya?ml|json|txt)$/i.test(entry.name)) files.push(path);
  }
  return files.sort();
}

function buildContractsDog(root: string, featureDir: string): string {
  const contractsDir = join(featureDir, 'contracts');
  const files = collectContractFiles(root, contractsDir);
  if (!files.length) return '';
  const chunks = ['# Contracts', '', 'Imported contracts are quoted so their syntax cannot create graph nodes or edges.', ''];
  for (const file of files) {
    chunks.push(`## ${relative(contractsDir, file).replace(/\\/g, '/')}`, '', quoteMarkdown(readSource(root, file, true)), '');
  }
  return chunks.join('\n');
}

function portablePath(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, '/') || '.';
}

function assertInsideRoot(root: string, output: string): void {
  const rel = relative(root, output);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Spec Kit output must be a subdirectory of the project root: ${output}`);
  }
  const topLevel = rel.split(/[\\/]+/)[0];
  if (['.git', '.specify', 'specs'].includes(topLevel)) {
    throw new Error(`Spec Kit output cannot overwrite repository or source metadata: ${output}`);
  }

  let current = root;
  for (const part of rel.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) continue;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked Spec Kit output path: ${current}`);
    if (current !== output && !stat.isDirectory()) throw new Error(`Spec Kit output parent is not a directory: ${current}`);
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`Refusing to overwrite symlink: ${path}`);
  }
  const temp = join(dirname(path), `.${path.split(/[\\/]/).pop()}.dotdog-${process.pid}-${randomBytes(8).toString('hex')}`);
  let fd: number | undefined;
  try {
    fd = openSync(temp, 'wx', 0o644);
    writeFileSync(fd, content);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temp)) unlinkSync(temp);
  }
}

function readManifest(path: string): ImportManifest | null {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlinked import manifest: ${path}`);
  try {
    const value = JSON.parse(readFileSync(path, 'utf-8'));
    if (value?.version !== 1 || value?.source !== 'github-spec-kit' || typeof value?.files !== 'object') return null;
    return value as ImportManifest;
  } catch {
    return null;
  }
}

function writeManagedArtifact(path: string, content: string, previousHash: string | undefined, force: boolean): ArtifactWrite {
  const normalized = `${content.trim()}\n`;
  const nextHash = sha256(normalized);
  if (!existsSync(path)) {
    atomicWrite(path, normalized);
    return { status: 'written', hash: nextHash };
  }
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing to overwrite symlink: ${path}`);

  const currentHash = fileSha256(path);
  if (currentHash === nextHash) return { status: 'unchanged', hash: nextHash };
  if (!force && currentHash !== previousHash) {
    return { status: 'skipped', hash: previousHash, reason: 'existing file was modified or is not managed by dotdog' };
  }

  atomicWrite(path, normalized);
  return { status: 'written', hash: nextHash };
}

export function importSpecKit(rootDir = '.', options: SpecKitImportOptions = {}): SpecKitImportResult {
  const root = resolve(rootDir);
  const specsDir = join(root, 'specs');
  assertSafeSourcePath(root, specsDir);
  if (!existsSync(specsDir) || !statSync(specsDir).isDirectory()) {
    throw new Error(`No Spec Kit specs directory found: ${specsDir}`);
  }

  const output = options.outputDir ? resolve(root, options.outputDir) : join(root, '.doghouse', 'speckit');
  assertInsideRoot(root, output);
  mkdirSync(output, { recursive: true });
  assertInsideRoot(root, output);

  const manifestPath = join(output, 'import.json');
  const previousManifest = readManifest(manifestPath);
  const previousFiles = previousManifest?.files || {};
  const managedFiles: Record<string, string> = {};
  const actions: SpecKitImportResult['actions'] = [];
  const constitution = readSource(root, join(root, '.specify', 'memory', 'constitution.md'));
  const features: SpecKitFeatureImport[] = [];

  const featureDirs = readdirSync(specsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(specsDir, entry.name, 'spec.md')))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of featureDirs) {
    const featureDir = join(specsDir, entry.name);
    const sourceSpecPath = join(featureDir, 'spec.md');
    const sourceSpec = readSource(root, sourceSpecPath, true);
    const title = featureTitle(sourceSpec, entry.name);
    const sourceTasks = readSource(root, join(featureDir, 'tasks.md'));
    const imported = buildSpecDog(entry.name, title, portablePath(root, sourceSpecPath), sourceSpec, sourceTasks);
    const featureOutput = join(output, entry.name);
    assertInsideRoot(root, featureOutput);
    mkdirSync(featureOutput, { recursive: true });
    assertInsideRoot(root, featureOutput);
    const artifacts: string[] = [];

    const plan = readSource(root, join(featureDir, 'plan.md'));
    const combinedPlan = [
      plan ? `# Implementation Plan\n\n${plan.trim()}` : '',
      sourceTasks ? `# Tasks\n\n${sourceTasks.trim()}` : '',
    ].filter(Boolean).join('\n\n');

    const artifactContents: Record<string, string> = {
      'SPEC.dog': imported.content,
      'constitution.dog': importedDocument('Constitution', constitution, 'No `.specify/memory/constitution.md` was present when this feature was imported.'),
      'data-model.dog': importedDocument('Data Model', readSource(root, join(featureDir, 'data-model.md')), 'No Spec Kit `data-model.md` was present when this feature was imported.'),
      'plan.dog': importedDocument('Implementation Plan', combinedPlan, 'No Spec Kit plan or tasks were present when this feature was imported.'),
    };
    const optionalArtifacts: Record<string, string> = {
      'research.dog': importedDocument('Research', readSource(root, join(featureDir, 'research.md')), ''),
      'quickstart.dog': importedDocument('Quickstart', readSource(root, join(featureDir, 'quickstart.md')), ''),
      'contracts.dog': buildContractsDog(root, featureDir),
    };
    for (const [name, content] of Object.entries(optionalArtifacts)) {
      if (content.trim()) artifactContents[name] = content;
    }

    for (const [name, content] of Object.entries(artifactContents)) {
      const relativeArtifact = `${entry.name}/${name}`;
      const result = writeManagedArtifact(join(output, relativeArtifact), content, previousFiles[relativeArtifact], options.force === true);
      artifacts.push(name);
      actions.push({ path: portablePath(root, join(output, relativeArtifact)), status: result.status, ...(result.reason ? { reason: result.reason } : {}) });
      if (result.hash) managedFiles[relativeArtifact] = result.hash;
    }

    features.push({
      id: entry.name,
      title,
      source: portablePath(root, sourceSpecPath),
      output: portablePath(root, featureOutput),
      artifacts,
      counts: imported.counts,
    });
  }

  const manifest: ImportManifest = {
    version: 1,
    source: 'github-spec-kit',
    output: portablePath(root, output),
    files: managedFiles,
    features,
  };
  atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const summary = {
    written: actions.filter((action) => action.status === 'written').length,
    unchanged: actions.filter((action) => action.status === 'unchanged').length,
    skipped: actions.filter((action) => action.status === 'skipped').length,
  };
  return { root: '.', output: portablePath(root, output), features, summary, actions };
}

export function formatSpecKitImport(result: SpecKitImportResult): string {
  if (!result.features.length) return `No Spec Kit features found under ${join(result.root, 'specs')}.`;
  const lines = [`Imported ${result.features.length} Spec Kit feature${result.features.length === 1 ? '' : 's'}:`];
  for (const feature of result.features) {
    const count = feature.counts;
    lines.push(`  ${feature.id}: ${count.userStories} stories, ${count.requirements} requirements, ${count.tasks} tasks → ${feature.output}`);
  }
  lines.push('', `${result.summary.written} written, ${result.summary.unchanged} unchanged, ${result.summary.skipped} preserved`);
  for (const action of result.actions.filter((item) => item.status === 'skipped')) {
    lines.push(`  preserved ${action.path}: ${action.reason}`);
  }
  lines.push('', `Compile: dotdog compile ${result.output}`);
  lines.push(`Serve:   dotdog serve ${result.output}`);
  return lines.join('\n');
}
