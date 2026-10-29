import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { countTokens, encode } from 'gpt-tokenizer/encoding/o200k_base';
import vectors from './fixtures/o200k-vectors.json';
import { budgetContext } from '../src/graph/context';
import { graphNeighborhood, normalizeGraph } from '../src/graph/model';
import { createMcpHandler } from '../src/serve';

const tokens = (data: unknown) => countTokens(JSON.stringify(data), { disallowedSpecial: new Set() });
const raw = { project: 'example', nodes: [
  { id: 'root', label: 'Controller', properties: { enabled: false, count: 0 }, schema: { enabled: { type: 'boolean', required: true, default: false } }, evidence: { sha256: 'a'.repeat(64) } },
  { id: 'noise', label: 'Unrelated', description: 'irrelevant '.repeat(2000) },
  { id: 'bridge', label: 'Bridge' },
  { id: 'brake', label: 'EmergencyBrake', evidence: { line: 7 } },
], edges: [
  { sourceId: 'root', targetId: 'noise', verb: 'imports' },
  { sourceId: 'root', targetId: 'bridge', verb: 'imports', evidence: { line: 2 } },
  { sourceId: 'bridge', targetId: 'brake', verb: 'calls', evidence: { line: 3 } },
] };

describe('token-budgeted context', () => {
  test('matches independently checked official tiktoken IDs including Unicode and special spellings', () => {
    for (const { text, tokens } of vectors.cases) expect(encode(text, { disallowedSpecial: new Set() })).toEqual(tokens);
  });
  test('ranks task evidence without splitting records or losing connecting provenance', async () => {
    const original = graphNeighborhood(normalizeGraph(raw), 'root', { depth: 2 });
    const result = await budgetContext(original, 700, 'emergency brake');
    expect(result.ok).toBe(true);
    expect(tokens(result)).toBeLessThanOrEqual(700);
    expect(result.nodes?.map(node => node.id)).toEqual(['root', 'bridge', 'brake']);
    expect(result.nodes?.[0]).toEqual(original.nodes[0]);
    expect(result.edges).toEqual(original.edges.slice(1));
    expect(result.truncated).toBe(true);
    expect('omitted' in result && result.omitted).toEqual({ nodes: 1, edges: 1 });
  });

  test('preserves incoming direction, full records and unchanged sufficient-budget results', async () => {
    const original = graphNeighborhood(normalizeGraph(raw), 'brake', { direction: 'incoming', depth: 2 });
    const result = await budgetContext(original, 10000);
    expect(result.nodes).toEqual(original.nodes);
    expect(result.edges).toEqual(original.edges);
    expect(tokens(result)).toBeLessThanOrEqual(10000);
    expect('omitted' in result && result.omitted).toEqual({ nodes: 0, edges: 0 });
  });

  test('rejects insufficient root budgets rather than presenting partial facts as complete', async () => {
    const graph = normalizeGraph({ nodes: [{ id: 'root', properties: { secretMeaning: '資料 '.repeat(4000) } }], edges: [] });
    const result = await budgetContext(graphNeighborhood(graph, 'root'), 128);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('budget_too_small');
    expect(result.nodes).toEqual([]);
    expect(tokens(result)).toBeLessThanOrEqual(128);
    await expect(budgetContext(graphNeighborhood(graph, 'root'), NaN)).rejects.toThrow('maxTokens');
    await expect(budgetContext(graphNeighborhood(graph, 'root'), 1024, 'x'.repeat(4097))).rejects.toThrow('task');
  });

  test('bounds ambiguous candidate errors and treats special-token spellings as ordinary data', async () => {
    const result = await budgetContext({ ok: false, error: 'ambiguous_endpoint', candidates: Array.from({ length: 100 }, (_, i) => `<|im_start|>${i}${'🐕'.repeat(40)}`) }, 160);
    expect(tokens(result)).toBeLessThanOrEqual(160);
    expect(result.error).toBe('ambiguous_endpoint');
    expect('omittedCandidates' in result && result.omittedCandidates).toBeGreaterThan(0);
  });

  test('CLI emits counted compact JSON; MCP exposes the same budget and rejects ignored task arguments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotdog-budget-'));
    try {
      writeFileSync(join(dir, 'example.dag'), JSON.stringify(raw));
      const cli = spawnSync(process.execPath, [join(import.meta.dir, '../src/cli.ts'), 'context', 'root', '--dag', 'example.dag', '--max-tokens', '700', '--task', 'emergency brake'], { cwd: dir, encoding: 'utf8' });
      expect(cli.status).toBe(0);
      const data = JSON.parse(cli.stdout);
      expect(countTokens(cli.stdout.trim(), { disallowedSpecial: new Set() })).toBeLessThanOrEqual(700);
      expect(data.nodes.map((node: any) => node.id)).toEqual(['root', 'bridge', 'brake']);
      const handler = createMcpHandler(dir);
      const call = (args: unknown) => handler({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'context', arguments: args } });
      const response = await call({ q: 'root', maxTokens: 700, task: 'emergency brake' });
      expect(response.result.structuredContent).toEqual(data);
      expect(response.result.content[0].text).toBe(JSON.stringify(data));
      expect((await call({ q: 'root', task: 'ignored?' })).error.code).toBe(-32602);
      expect((await call({ q: 'root', maxTokens: 700, task: 'x'.repeat(4097) })).error.code).toBe(-32602);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
