import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, normalize, sep } from 'node:path';

function fail(message) {
  console.error(`Spec Kit extension check failed: ${message}`);
  process.exit(1);
}

function requireRegularFile(path) {
  if (!existsSync(path)) fail(`${path} is missing`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) fail(`${path} must not be a symlink`);
  if (!stat.isFile()) fail(`${path} must be a regular file`);
}

function requireHttps(value, field) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:') fail(`${field} must use HTTPS`);
}

const manifestPath = 'extension.yml';
requireRegularFile(manifestPath);

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`extension.yml must be valid JSON-compatible YAML: ${error.message}`);
}

const extension = manifest.extension || {};
const commands = manifest.provides?.commands;
requireRegularFile('packages/dotdog/package.json');
const packageJson = JSON.parse(readFileSync('packages/dotdog/package.json', 'utf8'));

if (manifest.schema_version !== '1.0') fail('schema_version must be 1.0');
if (!/^[a-z0-9-]+$/.test(extension.id || '')) fail('extension.id is invalid');
if (!extension.name || typeof extension.name !== 'string') fail('extension.name is required');
if (!/^\d+\.\d+\.\d+$/.test(extension.version || '')) fail('extension.version must use semantic versioning');
if (extension.version !== packageJson.version) fail('extension version must match the dotdog package version');
if (!extension.description || extension.description.length > 200) fail('extension.description must be 1-200 characters');
if (!extension.author || typeof extension.author !== 'string') fail('extension.author is required');
if (extension.license !== 'MIT') fail('extension.license must be MIT');
requireHttps(extension.repository, 'extension.repository');
requireHttps(extension.homepage, 'extension.homepage');
if (!['docs', 'code', 'process', 'integration', 'visibility'].includes(extension.category)) fail('extension.category is invalid');
if (!['read-only', 'read-write'].includes(extension.effect)) fail('extension.effect is invalid');
if (!/^>=\d+\.\d+\.\d+$/.test(manifest.requires?.speckit_version || '')) fail('requires.speckit_version is invalid');
if (manifest.hooks !== undefined) fail('hooks are not permitted for the initial Dotdog extension release');

const tools = manifest.requires?.tools;
if (!Array.isArray(tools) || tools.length !== 1) fail('exactly one required tool must be declared');
if (tools[0]?.name !== 'dotdog' || tools[0]?.required !== true || !/^>=\d+\.\d+\.\d+$/.test(tools[0]?.version || '')) {
  fail('the required dotdog tool declaration is invalid');
}

if (!Array.isArray(commands) || commands.length === 0) fail('at least one command is required');
const expectedCommands = new Set([
  'speckit.dotdog.import',
  'speckit.dotdog.inspect',
  'speckit.dotdog.serve',
]);
const commandName = new RegExp(`^speckit\\.${extension.id}\\.[a-z0-9-]+$`);
const seen = new Set();
const forbidden = [
  /\beval\b/i,
  /\bbash\s+-c\b/i,
  /\bsh\s+-c\b/i,
  /\bsudo\b/i,
  /\bcurl\b[^\n]*\|\s*(?:sh|bash)\b/i,
  /\bwget\b[^\n]*\|\s*(?:sh|bash)\b/i,
  /\b0\.0\.0\.0\b/,
  /\b(?:nc|ncat|socat)\b/i,
];

for (const command of commands) {
  if (!commandName.test(command.name || '')) fail(`invalid command name: ${command.name}`);
  if (!expectedCommands.has(command.name)) fail(`unexpected command: ${command.name}`);
  if (seen.has(command.name)) fail(`duplicate command name: ${command.name}`);
  seen.add(command.name);
  if (!command.description) fail(`missing description for ${command.name}`);

  const file = command.file || '';
  const normalized = normalize(file);
  if (isAbsolute(file) || normalized.startsWith(`..${sep}`) || !/^commands\/[a-z0-9-]+\.md$/.test(file)) {
    fail(`unsafe command file path: ${file}`);
  }
  requireRegularFile(file);

  const content = readFileSync(file, 'utf8');
  if (!content.startsWith('---\n')) fail(`${file} is missing frontmatter`);
  if (!/^description:\s*".+"$/m.test(content)) fail(`${file} is missing a frontmatter description`);
  if (!content.includes('$ARGUMENTS')) fail(`${file} must document $ARGUMENTS`);
  if (!content.includes('Do not interpolate `$ARGUMENTS` into a shell command.')) {
    fail(`${file} must prohibit shell interpolation of user input`);
  }

  let inFence = false;
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    else if (inFence && line.includes('$ARGUMENTS')) fail(`${file} places $ARGUMENTS inside executable code`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(content)) fail(`${file} contains a forbidden execution pattern: ${pattern}`);
  }
}

if (seen.size !== expectedCommands.size) fail('the command set is incomplete');

const tags = manifest.tags;
if (!Array.isArray(tags) || tags.length < 2 || tags.length > 10) fail('tags must contain 2-10 values');
for (const tag of tags) {
  if (!/^[a-z0-9-]+$/.test(tag)) fail(`invalid tag: ${tag}`);
}

for (const requiredFile of ['README.md', 'LICENSE', 'CHANGELOG.md', '.extensionignore', 'docs/spec-kit-extension.md']) {
  requireRegularFile(requiredFile);
}

const ignoreLines = new Set(
  readFileSync('.extensionignore', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);
for (const requiredRule of ['*', '!extension.yml', '!commands/', '!commands/**', '!README.md', '!LICENSE', '!CHANGELOG.md']) {
  if (!ignoreLines.has(requiredRule)) fail(`.extensionignore is missing ${requiredRule}`);
}

const docs = readFileSync('docs/spec-kit-extension.md', 'utf8');
const releaseAsset = `https://github.com/specdog/dotdog/releases/download/v${extension.version}/dotdog-spec-kit-extension-v${extension.version}.zip`;
if (!docs.includes(releaseAsset)) fail('extension documentation must reference the versioned release asset');
if (!docs.includes('local-only')) fail('extension documentation must state the local-only security boundary');

requireRegularFile('.github/workflows/spec-kit-extension-release.yml');
const releaseWorkflow = readFileSync('.github/workflows/spec-kit-extension-release.yml', 'utf8');
if (!releaseWorkflow.includes('permissions:\n  contents: write')) fail('release workflow must declare minimal release permissions');
if (!/actions\/checkout@[0-9a-f]{40}/.test(releaseWorkflow)) fail('release workflow actions must be pinned by commit SHA');
if (!releaseWorkflow.includes('test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"')) {
  fail('release workflow must only release the exact main commit');
}
if (/pull_request_target:/.test(releaseWorkflow)) fail('release workflow must not use pull_request_target');

console.log(`Spec Kit extension check passed: ${commands.length} commands, version ${extension.version}`);
