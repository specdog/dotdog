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

  test('fails closed for ambiguous endpoint matches and hop limits', () => {
    const ambiguous = shortestGraphPath({ ...graph, nodes: [...graph.nodes, { id: 'd', label: 'User Store' }] }, 'User', 'Audit Log');
    expect(ambiguous.error).toBe('ambiguous_endpoint');
    const limited = shortestGraphPath(graph, 'User Service', 'Audit Log', { maxHops: 1 });
    expect(limited.error).toBe('no_path');
  });
});
