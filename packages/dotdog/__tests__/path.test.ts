import { describe, expect, test } from 'bun:test';
import { shortestGraphPath } from '../src/graph/path';

describe('shortest graph path', () => {
  const graph = {
    nodes: [
      { id: 'a', label: 'User Service', kind: 'symbol', confidence: 'certain' },
      { id: 'b', label: 'Database Pool', kind: 'symbol', confidence: 'likely' },
      { id: 'c', label: 'Audit Log', kind: 'file', confidence: 'certain' },
    ],
    edges: [
      { sourceId: 'a', targetId: 'b', verb: 'calls', confidence: 'certain' },
      { sourceId: 'b', targetId: 'c', verb: 'writes', confidence: 'likely' },
    ],
  };

  test('returns the shortest connecting subgraph and preserves edge metadata', () => {
    const result = shortestGraphPath(graph, 'User', 'Audit Log');
    expect(result.ok).toBe(true);
    expect(result.hops).toBe(2);
    expect(result.nodes.map((node) => node.label)).toEqual(['User Service', 'Database Pool', 'Audit Log']);
    expect(result.edges[1].confidence).toBe('likely');
  });

  test('supports reverse traversal without rewriting edge direction', () => {
    const result = shortestGraphPath(graph, 'Audit Log', 'User Service', { direction: 'incoming' });
    expect(result.ok).toBe(true);
    expect(result.edges.map((edge) => edge.sourceId)).toEqual(['b', 'a']);
  });

  test('does not resolve unmatched punctuation or Unicode queries to arbitrary nodes', () => {
    const single = { nodes: [{ id: 'a', label: 'User Service' }], edges: [] };
    for (const query of ['!!!', '🐕', '不存在']) {
      expect(shortestGraphPath(single, query, 'a').error).toBe('endpoint_not_found');
      expect(shortestGraphPath(graph, query, 'a').error).toBe('endpoint_not_found');
    }
    const unicode = { nodes: [...single.nodes, { id: 'b', label: '部署 🐕' }], edges: [{ sourceId: 'a', targetId: 'b', verb: 'calls' }] };
    expect(shortestGraphPath(unicode, '🐕', 'a').nodes.map(node => node.id)).toEqual(['b', 'a']);
    expect(shortestGraphPath(unicode, '部署', 'a').ok).toBe(true);
  });

  test('returns bounded exact IDs for ambiguous endpoints', () => {
    const nodes = Array.from({ length: 150 }, (_, i) => ({ id: `id:${i}`, label: 'Shared' }));
    const result = shortestGraphPath({ nodes, edges: [] }, 'Shared', 'id:0');
    expect(result.error).toBe('ambiguous_endpoint');
    expect(result.candidates).toHaveLength(100);
    expect(new Set(result.candidates).size).toBe(100);
    expect(result.candidates?.every(id => id.startsWith('id:'))).toBe(true);
    expect(result.truncated).toBe(true);
    expect(shortestGraphPath({ nodes, edges: [] }, 'id:0', 'id:0').ok).toBe(true);
  });

  test('fails closed for ambiguous endpoint matches and hop limits', () => {
    const ambiguous = shortestGraphPath({ ...graph, nodes: [...graph.nodes, { id: 'd', label: 'User Store' }] }, 'User', 'Audit Log');
    expect(ambiguous.error).toBe('ambiguous_endpoint');
    const limited = shortestGraphPath(graph, 'User Service', 'Audit Log', { maxHops: 1 });
    expect(limited.error).toBe('no_path');
    expect(limited.truncated).toBe(true);
    expect(limited.maxHops).toBe(1);
  });

  test('preserves graph coverage on positive, missing and bounded negative results', () => {
    const partial = { ...graph, coverage: { status: 'partial', scope: 'supplied traversal' }, limitations: ['Indirect calls unresolved'] };
    for (const result of [
      shortestGraphPath(partial, 'a', 'c'),
      shortestGraphPath(partial, 'a', 'missing'),
      shortestGraphPath(partial, 'c', 'a', { direction: 'outgoing' }),
    ]) {
      expect(result.coverage).toEqual(partial.coverage);
      expect(result.limitations).toContain('Indirect calls unresolved');
    }
    expect(shortestGraphPath(graph, 'a', 'b').coverage).toEqual({ status: 'unknown', scope: 'supplied graph' });
    expect(shortestGraphPath(graph, 'a', 'c', { maxHops: 2 }).truncated).toBe(false);
    expect(shortestGraphPath({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [] }, 'a', 'b').truncated).toBe(false);
  });

  test('agrees with independent all-pairs distances on cyclic directed graphs', () => {
    let seed = 97;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let sample = 0; sample < 12; sample++) {
      const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}` }));
      const edges = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, sourceId: `n${random() % 12}`, targetId: `n${random() % 12}`, verb: i % 2 ? 'calls' : 'writes', evidence: { line: i } }));
      for (const direction of ['incoming', 'outgoing', 'any'] as const) for (const verb of ['', 'calls']) {
        const distance = nodes.map((_, i) => nodes.map((_, j) => i === j ? 0 : Infinity));
        for (const edge of edges) {
          if (verb && edge.verb !== verb) continue;
          const from = Number(edge.sourceId.slice(1)), to = Number(edge.targetId.slice(1));
          if (direction !== 'incoming') distance[from][to] = Math.min(distance[from][to], 1);
          if (direction !== 'outgoing') distance[to][from] = Math.min(distance[to][from], 1);
        }
        for (let k = 0; k < nodes.length; k++) for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
          distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j]);
        }
        for (const [from, to] of [[0, 0], [0, 5], [5, 0], [3, 8]]) for (const maxHops of [1, 4]) {
          const result = shortestGraphPath({ nodes, edges }, `n${from}`, `n${to}`, { direction, verb, maxHops });
          expect(result.ok).toBe(distance[from][to] <= maxHops);
          if (result.ok) {
            expect(result.hops).toBe(distance[from][to]);
            expect(result.nodes.map(node => node.id).filter((_, i) => i === 0 || i === result.nodes.length - 1)).toEqual(from === to ? [`n${from}`] : [`n${from}`, `n${to}`]);
            for (const [i, edge] of result.edges.entries()) {
              expect(edge.evidence).toEqual(edges.find(item => item.id === edge.id)?.evidence);
              const first = result.nodes[i].id, second = result.nodes[i + 1].id;
              expect(direction !== 'incoming' && edge.sourceId === first && edge.targetId === second || direction !== 'outgoing' && edge.sourceId === second && edge.targetId === first).toBe(true);
              if (verb) expect(edge.verb).toBe(verb);
            }
          } else expect(result.error).toBe('no_path');
        }
      }
    }
  });
});
