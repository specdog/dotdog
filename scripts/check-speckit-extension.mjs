import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  console.error(`Spec Kit extension check failed: ${message}`);
  process.exit(1);
}

const manifestPath = 'extension.yml';
if (!existsSync(manifestPath)) fail('extension.yml is missing');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`extension.yml must be valid JSON-compatible YAML: ${error.message}`);
}

const extension = manifest.extension || {};
const commands = manifest.provides?.commands;
const packageJson = JSON.parse(readFileSync('packages/dotdog/package.json', 'utf8'));

if (manifest.schema_version !== '1.0') fail('schema_version must be 1.0');
if (!/^[a-z0-9-]+$/.test(extension.id || '')) fail('extension.id is invalid');
if (!/^\d+\.\d+\.\d+$/.test(extension.version || '')) fail('extension.version must use semantic versioning');
if (extension.version !== packageJson.version) fail('extension version must match the dotdog package version');
if (!extension.description || extension.description.length > 200) fail('extension.description must be 1-200 characters');
if (!['docs', 'code', 'process', 'integration', 'visibility'].includes(extension.category)) fail('extension.category is invalid');
if (!['read-only', 'read-write'].includes(extension.effect)) fail('extension.effect is invalid');
if (!/^>=\d+\.\d+\.\d+$/.test(manifest.requires?.speckit_version || '')) fail('requires.speckit_version is invalid');
if (!Array.isArray(commands) || commands.length === 0) fail('at least one command is required');

const commandName = new RegExp(`^speckit\\.${extension.id}\\.[a-z0-9-]+$`);
const seen = new Set();
for (const command of commands) {
  if (!commandName.test(command.name || '')) fail(`invalid command name: ${command.name}`);
  if (seen.has(command.name)) fail(`duplicate command name: ${command.name}`);
  seen.add(command.name);
  if (!command.description) fail(`missing description for ${command.name}`);
  if (!command.file || !existsSync(command.file)) fail(`missing command file: ${command.file}`);

  const content = readFileSync(command.file, 'utf8');
  if (!content.startsWith('---\n')) fail(`${command.file} is missing frontmatter`);
  if (!/^description:\s*".+"$/m.test(content)) fail(`${command.file} is missing a frontmatter description`);
  if (!content.includes('$ARGUMENTS')) fail(`${command.file} must document $ARGUMENTS`);
}

for (const requiredFile of ['README.md', 'LICENSE', 'CHANGELOG.md', 'docs/spec-kit-extension.md']) {
  if (!existsSync(requiredFile)) fail(`${requiredFile} is missing`);
}

console.log(`Spec Kit extension check passed: ${commands.length} commands, version ${extension.version}`);
