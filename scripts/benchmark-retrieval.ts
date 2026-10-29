import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  tokenizer: { type: 'string' }, output: { type: 'string' },
  implementation: { type: 'string' },
  nodes: { type: 'string', default: '10000' }, samples: { type: 'string', default: '50' },
} });
assert.ok(values.tokenizer && values.output, '--tokenizer <gpt-tokenizer package directory> and --output <new JSON file> are required');
const implementation = resolve(values.implementation || fileURLToPath(new URL('..', import.meta.url)));
const { createMcpHandler } = await import(pathToFileURL(join(implementation, 'packages/dotdog/src/serve.ts')).href);
const { normalizeGraph } = await import(pathToFileURL(join(implementation, 'packages/dotdog/src/graph/model.ts')).href);
const nodeCount = Number(values.nodes), samples = Number(values.samples);
assert.ok(Number.isInteger(nodeCount) && nodeCount >= 64 && nodeCount <= 100000, 'nodes must be 64–100000');
assert.ok(Number.isInteger(samples) && samples >= 20 && samples <= 1000, 'samples must be 20–1000');
const root = mkdtempSync(join(tmpdir(), 'dotdog-retrieval-'));
try {
  const groupSize = 32;
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `component:${i}`, label: `Component ${i}`, kind: 'component',
    description: `Synthetic component ${i} in independent subsystem ${Math.floor(i / groupSize)}`,
    source: `src/subsystem-${Math.floor(i / groupSize)}/component-${i}.ts`,
    properties: { enabled: true, revision: 1 }, confidence: 'observed',
  }));
  const edges = nodes.flatMap((node, i) => i + 1 < nodeCount && (i + 1) % groupSize !== 0
    ? [{ id: `calls:${i}`, sourceId: node.id, targetId: nodes[i + 1].id, verb: 'calls', evidence: { line: 3 } }]
    : []);
  const source = JSON.stringify({ project: 'benchmark', nodes, edges });
  const graphFile = join(root, 'benchmark.dag');
  writeFileSync(graphFile, source);
  const handle = createMcpHandler(root);
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    assert.ok(!response.error && !response.result.isError, JSON.stringify(response));
    return response.result;
  };
  const timed = async (name: string, args: Record<string, unknown>) => {
    const start = performance.now();
    const result = await call(name, args);
    return { ms: performance.now() - start, result };
  };
  const cold = await timed('context', { q: 'component:16', depth: 2 });
  const latencies: Record<string, number[]> = { getEntity: [], context: [], impact: [] };
  const fullGroups = Math.floor(nodeCount / groupSize);
  for (let i = 0; i < samples + 10; i++) {
    const center = (i % fullGroups) * groupSize + 16, id = `component:${center}`;
    for (const name of Object.keys(latencies)) {
      const args = name === 'getEntity' ? { name: id } : name === 'context' ? { q: id, depth: 2 } : { from: id, depth: 2 };
      const { ms, result } = await timed(name, args);
      if (i >= 10) latencies[name].push(ms);
      const data = result.structuredContent;
      if (name === 'getEntity') assert.equal(data.name, `Component ${center}`);
      else {
        const expected = (name === 'context' ? [-2, -1, 0, 1, 2] : [-2, -1, 0]).map(offset => `component:${center + offset}`).sort();
        assert.equal(data.ok, true); assert.equal(data.truncated, false);
        assert.deepEqual(data.nodes.map((node: any) => node.id).sort(), expected);
        assert.equal(data.edges.length, expected.length - 1);
        assert.ok(data.edges.every((edge: any) => edge.evidence.line === 3));
      }
    }
  }
  assert.equal((await call('context', { q: 'missing-component' })).structuredContent.error, 'endpoint_not_found');
  const replacement = JSON.parse(source);
  replacement.nodes[16].description = 'Fresh replacement description';
  writeFileSync(graphFile, JSON.stringify(replacement));
  assert.equal((await call('context', { q: 'component:16', depth: 0 })).structuredContent.nodes[0].description, 'Fresh replacement description');
  const retrievalRssBytes = process.memoryUsage().rss;
  const tokenizerRoot = resolve(values.tokenizer);
  const tokenizerPkg = JSON.parse(readFileSync(join(tokenizerRoot, 'package.json'), 'utf8'));
  assert.equal(tokenizerPkg.name, 'gpt-tokenizer'); assert.equal(tokenizerPkg.version, '4.1.0');
  const { encode } = await import(pathToFileURL(join(tokenizerRoot, 'esm/encoding/o200k_base.js')).href);
  const count = (text: string) => encode(text, { disallowedSpecial: new Set() }).length;
  const wholeGraphTokens = count(JSON.stringify(normalizeGraph(JSON.parse(source))));
  const contextTextTokens = count(cold.result.content[0].text);
  const report = {
    schema: 1, scope: 'synthetic exact-ID graph retrieval; not semantic retrieval or end-to-end model accuracy',
    fixture: { nodes: nodeCount, edges: edges.length, groupSize, sha256: createHash('sha256').update(source).digest('hex') },
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: implementation, encoding: 'utf8' }).trim(),
    workingDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', '--', 'packages/dotdog/src'], { cwd: implementation })).digest('hex'),
    runtime: { node: process.version, bun: process.versions.bun, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
    measurement: { samples, warmup: 10, coldContextMs: cold.ms, retrievalRssBytes,
      warmMs: Object.fromEntries(Object.entries(latencies).map(([name, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return [name, { p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], raw: values }];
      })),
    },
    tokens: { tokenizer: `${tokenizerPkg.name}@${tokenizerPkg.version}`, encoding: 'o200k_base',
      baseline: 'entire normalized synthetic graph JSON, not the previous context implementation',
      wholeGraphTokens, contextTextTokens, contextResultEnvelopeTokens: count(JSON.stringify(cold.result)),
      reductionVsWholeGraph: 1 - contextTextTokens / wholeGraphTokens,
      excludes: 'prompt, tool definitions, chat framing, other calls, output, host-specific duplication and billing' },
    assertions: { exactNeighborhoods: true, evidencePreserved: true, noAnswer: true, changedGraphReloaded: true },
    limitations: ['In-process MCP handler, not stdio/host overhead', 'Page cache is not cleared for the first request', 'RSS is a post-retrieval snapshot including fixture generation, not peak or isolated index memory', 'No lexical, semantic-vector or VSA comparison yet'],
  };
  writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...report, measurement: { ...report.measurement, warmMs: Object.fromEntries(Object.entries(report.measurement.warmMs).map(([name, { raw, ...rest }]) => [name, rest])) } }));
} finally { rmSync(root, { recursive: true, force: true }); }
