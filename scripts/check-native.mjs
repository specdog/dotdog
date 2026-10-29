import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../packages/dotdog/package.json', import.meta.url));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);
const { values } = parseArgs({ options: { solidstate: { type: 'string' }, binary: { type: 'string' }, output: { type: 'string' }, symbol: { type: 'string', default: '_dotdog_validate' } } });
for (const key of ['solidstate', 'binary', 'output']) assert.ok(values[key], `--${key} is required`);
const binary = resolve(values.binary), output = resolve(values.output), solidstate = resolve(values.solidstate);
const cli = fileURLToPath(new URL('../packages/dotdog/dist/cli.js', import.meta.url));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const binarySha256 = digest(binary);
mkdirSync(output, { recursive: false, mode: 0o700 });
const client = new Client({ name: 'dotdog-native-release-check', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [solidstate, 'reverse', 'mcp'], stderr: 'pipe' });
let opened = false;
try {
  await client.connect(transport);
  const result = await client.callTool({ name: 'open_binary', arguments: { path: binary, provider_id: 'ghidra' } }, undefined, { timeout: 180000 });
  assert.ok(!result.isError, JSON.stringify(result));
  opened = true;
  const response = await client.callTool({ name: 'get_call_graph', arguments: { address: values.symbol, direction: 'forward' } }, undefined, { timeout: 180000 });
  assert.ok(!response.isError, JSON.stringify(response));
  const evidence = response.structuredContent;
  assert.equal(evidence.subject.digest.sha256, binarySha256);
  const body = evidence.normalized_result, start = body.graph['0'][0];
  assert.equal(start.status, 'ok');
  assert.ok(start.calls.length > 0, 'Expected the fixture procedure to call another procedure');
  const graphFile = join(output, 'native-callgraph.json');
  writeFileSync(graphFile, JSON.stringify(body, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(join(output, 'evidence.private.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: output, encoding: 'utf8' });
  const imported = JSON.parse(run('graph', 'import', 'native-callgraph.json', '--format', 'rea-callgraph', '--project', 'native-fixture', '--artifact-sha256', binarySha256));
  const path = JSON.parse(run('path', start.address, start.calls[0], '--dag', '.doghouse/imported/native-fixture.dag', '--json'));
  assert.equal(path.ok, true); assert.equal(path.hops, 1);
  assert.equal(digest(binary), binarySha256);
  const verification = { binarySha256, exportSha256: digest(graphFile), operation: evidence.operation, profile: evidence.analysis_profile, importedNodes: imported.nodes, importedEdges: imported.edges, verifiedPathHops: path.hops, targetExecuted: false, limitations: body.limitations };
  writeFileSync(join(output, 'verification.json'), JSON.stringify(verification, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ binarySha256, importedNodes: imported.nodes, importedEdges: imported.edges, verifiedPathHops: path.hops, targetExecuted: false }));
} finally {
  try {
    if (opened) { const closed = await client.callTool({ name: 'close_binary', arguments: {} }); assert.ok(!closed.isError, 'Provider did not confirm session close'); }
  } finally { await client.close(); }
}
