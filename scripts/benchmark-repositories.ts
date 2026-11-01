import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { createMcpHandler } from '../packages/dotdog/src/serve';

const require = createRequire(new URL('../packages/dotdog/package.json', import.meta.url));
const { countTokens } = require('gpt-tokenizer/encoding/o200k_base');

const { values } = parseArgs({ options: {
  repo: { type: 'string', multiple: true }, output: { type: 'string' }, samples: { type: 'string', default: '20' },
} });
assert.ok(values.output && values.repo?.length, '--repo name=/absolute/checkout (repeatable) and --output <new JSON file> required');
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 10 && samples <= 1000, 'samples must be 10–1000');
const roots = new Map(values.repo.map(entry => {
  const split = entry.indexOf('='); assert.ok(split > 0, 'Use --repo name=/absolute/checkout');
  return [entry.slice(0, split), resolve(entry.slice(split + 1))];
}));
const tasksFile = new URL('../benchmarks/retrieval/tasks.json', import.meta.url);
const taskBytes = readFileSync(tasksFile), suite = JSON.parse(taskBytes.toString());
const count = (value: unknown) => countTokens(typeof value === 'string' ? value : JSON.stringify(value), { disallowedSpecial: new Set() });
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const repositories = [];
let regression = false;
for (const repository of suite.repositories) {
  const root = roots.get(repository.name);
  if (!root) continue;
  assert.equal(git(root, 'rev-parse', 'HEAD'), repository.revision, 'Repository revision does not match frozen labels');
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '', 'Tracked source must be unchanged');
  const handle = createMcpHandler(root);
  const call = async (name: string, args = {}) => {
    const response = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    assert.ok(!response.error && !response.result.isError, JSON.stringify(response));
    return response.result;
  };
  const projects = (await call('listProjects')).structuredContent.items;
  const observed = projects.filter((name: string) => name.endsWith(':observed'));
  assert.equal(observed.length, 1, 'Run dotdog refresh in the pinned checkout before benchmarking');
  const project = observed[0], summary = (await call('summary', { project })).structuredContent;
  const cases = [];
  for (const task of repository.tasks) {
    const baseArgs = { project, q: task.q, depth: 2, limit: 100 };
    const outputs: Record<string, any> = {};
    for (const [method, args] of [ ['baseline', baseArgs], ['budgeted', { ...baseArgs, task: task.task, maxTokens: task.maxTokens }] ] as const) {
      const times = [], rss = [];
      let result: any;
      for (let i = 0; i < samples + 2; i++) {
        const start = performance.now();
        result = await call('context', args);
        const elapsed = performance.now() - start;
        if (i >= 2) { times.push(elapsed); rss.push(process.memoryUsage().rss); }
      }
      const data = result.structuredContent, labels = new Set(data.nodes?.map((node: any) => node.label) || []);
      const missing = task.required.filter((label: string) => !labels.has(label));
      const byLabel = new Map((data.nodes || []).map((node: any) => [node.label, node.id]));
      const missingRelationships = task.required.filter((label: string) => label !== task.q && !data.edges?.some((edge: any) => edge.sourceId === byLabel.get(task.q) && edge.targetId === byLabel.get(label) && edge.verb === 'defines'));
      const expectedError = task.expectedError ? data.ok === false && data.error === task.expectedError : data.ok === true;
      const qualityPassed = expectedError && missing.length === 0 && missingRelationships.length === 0;
      outputs[method] = { data, qualityPassed, missing, missingRelationships,
        distractorsSelected: task.distractors.filter((label: string) => labels.has(label)),
        tokens: { text: count(result.content[0].text), resultEnvelope: count(result), request: count({ name: 'context', arguments: args }) },
        latencyMs: { p50: percentile(times, 0.5), p95: percentile(times, 0.95), raw: times },
        rssSamplesBytes: rss, candidateTruncated: Boolean(data.truncated), nodes: data.nodes?.length || 0, edges: data.edges?.length || 0,
      };
    }
    const { baseline, budgeted } = outputs;
    assert.ok(baseline.qualityPassed, `Frozen task is not supported by the baseline graph: ${task.id}`);
    assert.ok(budgeted.tokens.text <= task.maxTokens, `Budget exceeded: ${task.id}`);
    const nodes = new Map((baseline.data.nodes || []).map((node: any) => [node.id, node]));
    const edges = new Map((baseline.data.edges || []).map((edge: any) => [edge.id, edge]));
    for (const node of budgeted.data.nodes || []) assert.deepEqual(node, nodes.get(node.id), 'Node record changed');
    for (const edge of budgeted.data.edges || []) {
      assert.deepEqual(edge, edges.get(edge.id), 'Edge evidence changed');
      assert.ok(budgeted.data.nodes.some((node: any) => node.id === edge.sourceId) && budgeted.data.nodes.some((node: any) => node.id === edge.targetId), 'Dangling selected edge');
    }
    if (!budgeted.qualityPassed) regression = true;
    cases.push({ id: task.id, cohort: task.cohort, maxTokens: task.maxTokens,
      baseline: { ...baseline, data: undefined }, budgeted: { ...budgeted, data: undefined },
      textTokenReduction: 1 - budgeted.tokens.text / baseline.tokens.text,
      baselinePayloadSha256: digest(JSON.stringify(baseline.data)), budgetedPayloadSha256: digest(JSON.stringify(budgeted.data)),
    });
  }
  repositories.push({ name: repository.name, url: repository.url, revision: repository.revision, graph: { nodes: summary.nodes, edges: summary.edges, limitations: summary.limitations }, cases });
}
assert.equal(repositories.length, roots.size, 'Unknown or duplicate repository name');
const sourceFiles = git(process.cwd(), 'ls-files', '--cached', '--others', '--exclude-standard', 'packages/dotdog/src').split('\n').filter(Boolean).sort();
const sourceHash = createHash('sha256');
for (const file of sourceFiles) sourceHash.update(file).update('\0').update(readFileSync(file)).update('\0');
const report = { schema: 1, revision: git(process.cwd(), 'rev-parse', 'HEAD'), implementationSha256: sourceHash.digest('hex'),
  taskLabelsSha256: digest(taskBytes), runtime: { node: process.version, bun: process.versions.bun, platform: process.platform, arch: process.arch },
  samples, warmup: 2, encoding: 'o200k_base', tokenizer: 'gpt-tokenizer@4.1.0', repositories,
  qualityRegression: regression,
  limitations: ['Nine manually labeled structural tasks in two public snapshots, not broad semantic or end-to-end agent evaluation', 'Baseline and budgeted requests run sequentially in one process; RSS samples are not peak memory', 'In-process MCP, not stdio or host latency', 'Graph records identify source evidence but do not include source bodies or prove runtime behavior', 'Text budget excludes MCP envelope, duplicated structured output and chat framing; envelope/request counts are reported separately', 'No semantic-vector/VSA comparison or actual billing measurement'],
};
writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ qualityRegression: regression, repositories: repositories.map(repo => ({ name: repo.name, cases: repo.cases.map(item => ({ id: item.id, cohort: item.cohort, passed: item.budgeted.qualityPassed, baselineTokens: item.baseline.tokens.text, budgetedTokens: item.budgeted.tokens.text, missing: item.budgeted.missing, missingRelationships: item.budgeted.missingRelationships, budgetedP50Ms: item.budgeted.latencyMs.p50 })) })) }));
if (regression) process.exitCode = 1;
