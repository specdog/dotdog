import { afterEach, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, truncateSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { inspectTypes } from '../src/types/inspect';
import { normalizeGraph, graphNeighborhood } from '../src/graph/model';
import { auditGraph } from '../src/graph/audit';
import { createMcpHandler } from '../src/serve';

const require = createRequire(new URL('../package.json', import.meta.url));
const compiler = dirname(require.resolve('typescript/package.json'));
const repository = resolve(import.meta.dir, '../../..');
const directories: string[] = [];
const model = 'export type Ready = { state: "ready"; id: string };\nexport type Done = { state: "done"; receipt: string };\nexport function commit(value: Ready): Done { return { state: "done", receipt: value.id }; }\n';
beforeAll(() => execFileSync('bun', ['run', 'build'], { cwd: repository, stdio: 'pipe' }));
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function fixture(installCompiler = true) {
  const root = mkdtempSync(join(tmpdir(), 'dotdog-types-')); directories.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'type-fixture', type: 'module' }));
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler' }, files: ['model.ts', 'index.ts', 'use.ts'] }));
  writeFileSync(join(root, 'model.ts'), model);
  writeFileSync(join(root, 'index.ts'), 'export { commit as complete } from "./model";');
  writeFileSync(join(root, 'use.ts'), 'import { complete } from "./index"; complete({ state: "ready", id: "one" });');
  if (installCompiler) {
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(compiler, join(root, 'node_modules/typescript'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  return root;
}
const inspect = (root: string, name = 'complete', file = 'index.ts') => inspectTypes(root, name, file, 'tsconfig.json');

test('native type inspection resolves a re-export, detects contract changes and repairs real diagnostics', async () => {
  const root = fixture(), before = await inspect(root);
  expect(before.ok).toBe(true);
  expect(before.compiler.version).toBe('7.0.2');
  expect(before.coverage.status).toBe('partial');
  const operation = before.nodes.find((node: any) => node.id === before.selectedId);
  expect(operation.label).toBe('model.ts#commit');
  expect(operation.origin.line).toBe(3);
  expect(operation.properties.signature).toContain('(value: Ready) => Done');
  expect(operation.properties.signature).not.toContain('value.id');
  const ready = before.nodes.find((node: any) => node.label === 'model.ts#Ready');
  expect(ready.properties.signature).toContain('state: "ready"');
  expect(graphNeighborhood(normalizeGraph(before), ready.id, { direction: 'incoming' }).nodes.some(node => node.id === operation.id)).toBe(true);
  expect(auditGraph(normalizeGraph(before), root).ok).toBe(true);
  expect(JSON.stringify(before)).not.toContain(root);
  writeFileSync(join(root, 'types.json'), JSON.stringify(before));
  execFileSync('node', [join(repository, 'packages/dotdog/dist/cli.js'), 'graph', 'import', 'types.json', '--project', 'type-contracts'], { cwd: root });
  const response = await createMcpHandler(root)({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'getEntity', arguments: { project: 'type-contracts', name: operation.id } } });
  expect(response.result.structuredContent.evidence?.compiler.version).toBe('7.0.2');
  expect(response.result.structuredContent.evidence?.inputSha256).toBe(before.inputSha256);
  writeFileSync(join(root, 'model.ts'), model.replace('id: string', 'id: number'));
  const invalid = await inspect(root);
  expect(invalid.ok).toBe(false);
  expect(invalid.error).toBe('typecheck_failed');
  expect(invalid.diagnostics.some((item: any) => item.code === 2322)).toBe(true);
  expect(auditGraph(normalizeGraph(before), root).findings.some(item => item.code === 'invalid_artifact')).toBe(true);
  writeFileSync(join(root, 'model.ts'), model);
  const repaired = await inspect(root);
  expect(repaired.ok).toBe(true);
  expect(repaired.inputSha256).toBe(before.inputSha256);
});

test('original inherited options and aliases are honored without declaration output', async () => {
  const root = fixture(), config = join(root, 'tsconfig.json'), output = join(root, 'user-output');
  mkdirSync(output); writeFileSync(join(output, 'keep.txt'), 'unchanged');
  writeFileSync(join(root, 'base.json'), JSON.stringify({ compilerOptions: { strict: true, strictNullChecks: true, exactOptionalPropertyTypes: true, noEmit: false, declaration: true, declarationDir: output, stripInternal: true, incremental: true, tsBuildInfoFile: join(output, 'cache.tsbuildinfo'), types: [], target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', paths: { '@model': ['./model.ts'] } } }));
  writeFileSync(config, '// JSONC configuration\n' + JSON.stringify({ extends: './base.json', files: ['model.ts', 'index.ts', 'use.ts'] }));
  writeFileSync(join(root, 'model.ts'), '/** @internal */\n' + model);
  writeFileSync(join(root, 'index.ts'), 'export { commit as complete } from "@model";');
  const bytes = readFileSync(config), result = await inspect(root);
  expect(result.ok).toBe(true);
  expect(result.config.checking.exactOptionalPropertyTypes).toBe(true);
  expect(result.nodes.some((node: any) => node.label === 'model.ts#Ready')).toBe(true);
  expect(readFileSync(config)).toEqual(bytes);
  expect(readFileSync(join(output, 'keep.txt'), 'utf8')).toBe('unchanged');
  expect(existsSync(join(output, 'model.d.ts'))).toBe(false);
  expect(existsSync(join(root, 'model.js'))).toBe(false);
  expect(existsSync(join(output, 'cache.tsbuildinfo'))).toBe(false);
  writeFileSync(join(root, 'base.json'), readFileSync(join(root, 'base.json'), 'utf8').replace('"strict":true', '"strict":false'));
  expect((await inspect(root)).config.checking.strict).toBe(false);
});

test('overloads, union contracts and repeated names keep distinct source identities', async () => {
  const root = fixture();
  writeFileSync(join(root, 'model.ts'), model + 'export function turn(value: Ready): Done;\nexport function turn(value: Done): Ready;\nexport function turn(value: Ready | Done): Ready | Done { return value.state === "ready" ? { state: "done", receipt: value.id } : { state: "ready", id: value.receipt }; }\nexport type State = Ready | Done;\n');
  const overload = await inspect(root, 'turn', 'model.ts');
  expect(overload.ok).toBe(true);
  const signature = overload.nodes.find((node: any) => node.id === overload.selectedId).properties.signature;
  expect(signature).toContain('(value: Ready): Done');
  expect(signature).toContain('(value: Done): Ready');
  const union = await inspect(root, 'State', 'model.ts');
  expect(union.ok).toBe(true);
  expect(union.nodes.filter((node: any) => node.kind === 'type').length).toBeGreaterThanOrEqual(3);
  writeFileSync(join(root, 'other.ts'), 'export type Ready = { other: boolean };');
  const config = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')); config.files.push('other.ts');
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(config));
  const first = await inspect(root, 'Ready', 'model.ts'), second = await inspect(root, 'Ready', 'other.ts');
  expect(first.ok && second.ok).toBe(true);
  expect(first.selectedId).not.toBe(second.selectedId);
});

test('unsupported checking, missing symbols/compiler and unsafe paths cannot become passes', async () => {
  const missing = fixture(false);
  expect((await inspect(missing)).error).toBe('compiler_missing');
  const root = fixture();
  expect((await inspect(root, 'missing')).error).toBe('export_not_found');
  expect((await inspectTypes(root, 'Ready', '../escape.ts', 'tsconfig.json')).error).toBe('invalid_request');
  const config = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
  delete config.compilerOptions.strict;
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(config));
  expect((await inspect(root)).config.checking).not.toHaveProperty('strict');
  config.compilerOptions.noCheck = true;
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(config));
  expect((await inspect(root)).error).toBe('compiler_config_unsupported');
  delete config.compilerOptions.noCheck; config.references = [{ path: './referenced' }];
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(config));
  expect((await inspect(root)).error).toBe('project_references_unsupported');
});

test('compiler input bounds reject oversized files without returning stale type data', async () => {
  const root = fixture();
  truncateSync(join(root, 'model.ts'), 32 * 1024 * 1024 + 1);
  const result = await inspect(root);
  expect(result.ok).toBe(false);
  expect(result.error).toBe('compiler_input_limit');
  expect(result.nodes).toEqual([]);
});

test('built CLI and Bun entry point use the packaged worker and real compiler', () => {
  const root = fixture(), cli = join(repository, 'packages/dotdog/dist/cli.js');
  for (const command of ['node', 'bun']) {
    const run = spawnSync(command, [cli, 'types', 'inspect', 'complete', '--file', 'index.ts', '--project', 'tsconfig.json', '--json'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).ok).toBe(true);
  }
});

test('long contracts are not silently truncated and external dependencies remain partial', async () => {
  const root = fixture();
  writeFileSync(join(root, 'model.ts'), model + `export type Wide = { ${Array.from({ length: 400 }, (_, i) => `p${i}: string`).join('; ')} };\nexport type Async = Promise<Ready>;`);
  const wide = await inspect(root, 'Wide', 'model.ts');
  expect(wide.ok).toBe(true);
  const signature = wide.nodes.find((node: any) => node.id === wide.selectedId).properties.signature;
  expect(signature).toContain('p399');
  expect(signature).not.toMatch(/\.\.\. \d+ more/);
  const external = await inspect(root, 'Async', 'model.ts');
  expect(external.ok).toBe(true);
  expect(external.coverage.status).toBe('partial');
  expect(external.limitations.some((item: string) => item.includes('Promise'))).toBe(true);
  const literal = '語'.repeat(21800);
  writeFileSync(join(root, 'model.ts'), model + `export type Literal = ${JSON.stringify(literal)};`);
  const unicode = await inspect(root, 'Literal', 'model.ts');
  expect(unicode.ok).toBe(true);
  expect(unicode.nodes.find((node: any) => node.id === unicode.selectedId).properties.signature).toBe(JSON.stringify(literal));
});

test('unsupported compilers, timeouts and excess worker output fail explicitly', async () => {
  const root = fixture(false), directory = join(root, 'node_modules/typescript');
  mkdirSync(directory, { recursive: true });
  const metadata = { name: 'typescript', version: '6.0.3', type: 'module', exports: { './package.json': './package.json', './unstable/sync': './api.mjs', './unstable/ast': './ast.mjs' } };
  writeFileSync(join(directory, 'package.json'), JSON.stringify(metadata));
  expect((await inspect(root)).error).toBe('compiler_version_unsupported');
  metadata.version = '7.0.2'; writeFileSync(join(directory, 'package.json'), JSON.stringify(metadata));
  writeFileSync(join(directory, 'ast.mjs'), 'export const SyntaxKind = {};');
  writeFileSync(join(directory, 'api.mjs'), 'import { spawn } from "node:child_process"; import { writeFileSync } from "node:fs"; export class API { constructor() { const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); writeFileSync("compiler-child.pid", String(child.pid)); for (;;) {} } }');
  const start = Date.now();
  const timed = await inspectTypes(root, 'complete', 'index.ts', 'tsconfig.json', 2000);
  expect(timed.error).toBe('compiler_timeout');
  expect(Date.now() - start).toBeLessThan(8000);
  const pid = Number(readFileSync(join(root, 'compiler-child.pid'), 'utf8'));
  const running = () => {
    try { process.kill(pid, 0); } catch (error: any) { if (error.code === 'ESRCH') return false; throw error; }
    if (process.platform === 'win32') return true;
    try { return !execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim().startsWith('Z'); }
    catch (error: any) { if (error.status === 1) return false; throw error; }
  };
  for (let i = 0; i < 10 && running(); i++) await new Promise(resolve => setTimeout(resolve, 50));
  expect(running()).toBe(false);
  writeFileSync(join(directory, 'api.mjs'), 'export class API { constructor() { console.log("x".repeat(2 * 1024 * 1024)); } updateSnapshot() { throw new Error("fixture"); } close() {} }');
  expect((await inspect(root)).error).toBe('compiler_output_limit');
}, 15000);
