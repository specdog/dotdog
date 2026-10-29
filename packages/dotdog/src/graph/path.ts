import { normalizeGraph, type GraphNode, type GraphEdge, type NormalizedGraph } from './model';

export type PathDirection = 'outgoing' | 'incoming' | 'any';

export type GraphPathResult = {
  ok: boolean;
  direction: PathDirection;
  hops: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  from?: { query: string; id: string; label: string };
  to?: { query: string; id: string; label: string };
  error?: 'endpoint_not_found' | 'ambiguous_endpoint' | 'no_path';
  candidates?: string[];
};

function endpoint(graph: NormalizedGraph, query: string): { node?: GraphNode; candidates?: string[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return {};
  const exact = graph.nodes.filter((node) => node.id.toLowerCase() === needle || node.label.toLowerCase() === needle);
  if (exact.length === 1) return { node: exact[0] };
  if (exact.length > 1) return { candidates: exact.map((node) => node.label).sort() };
  const terms = needle.split(/[^a-z0-9]+/).filter(Boolean);
  const full = graph.nodes.filter((node) => {
    const labels = node.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return terms.every((term) => labels.includes(term));
  });
  if (full.length === 1) return { node: full[0] };
  if (full.length > 1) return { candidates: full.map((node) => node.label).sort() };
  const partial = graph.nodes.filter((node) => node.label.toLowerCase().includes(needle));
  if (partial.length === 1) return { node: partial[0] };
  return partial.length > 1 ? { candidates: partial.map((node) => node.label).sort() } : {};
}

export function shortestGraphPath(
  dag: unknown,
  fromQuery: string,
  toQuery: string,
  options: { direction?: PathDirection; verb?: string; maxHops?: number } = {},
): GraphPathResult {
  const direction = options.direction || 'any';
  if (!['outgoing', 'incoming', 'any'].includes(direction)) throw new Error('Invalid path direction');
  const graph = normalizeGraph(dag);
  const from = endpoint(graph, fromQuery);
  const to = endpoint(graph, toQuery);
  const base = { ok: false, direction, hops: 0, nodes: [], edges: [] } as GraphPathResult;
  if (!from.node) return { ...base, ok: false, error: from.candidates ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: from.candidates };
  if (!to.node) return { ...base, ok: false, error: to.candidates ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: to.candidates };
  const fromInfo = { query: fromQuery, id: from.node.id, label: from.node.label };
  const toInfo = { query: toQuery, id: to.node.id, label: to.node.label };
  const maxHops = options.maxHops ?? 8;
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 12) throw new Error('maxHops must be an integer from 1 to 12');
  const verb = (options.verb || '').toLowerCase();
  const adjacency = new Map<string, Array<{ edge: GraphEdge; next: string }>>();
  const add = (id: string, edge: GraphEdge, next: string) => adjacency.set(id, [...(adjacency.get(id) || []), { edge, next }]);
  for (const edge of graph.edges) {
    if (verb && edge.verb.toLowerCase() !== verb) continue;
    if (direction === 'outgoing' || direction === 'any') add(edge.sourceId, edge, edge.targetId);
    if (direction === 'incoming' || direction === 'any') add(edge.targetId, edge, edge.sourceId);
  }
  const queue: Array<{ id: string; nodes: string[]; edges: GraphEdge[] }> = [{ id: from.node.id, nodes: [from.node.id], edges: [] }];
  const visited = new Set([from.node.id]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.id === to.node.id) {
      const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
      return { ok: true, direction, hops: current.edges.length, from: fromInfo, to: toInfo, nodes: current.nodes.map((id) => nodeById.get(id)!).filter(Boolean), edges: current.edges };
    }
    if (current.edges.length >= maxHops) continue;
    for (const next of adjacency.get(current.id) || []) {
      if (visited.has(next.next)) continue;
      visited.add(next.next);
      queue.push({ id: next.next, nodes: [...current.nodes, next.next], edges: [...current.edges, next.edge] });
    }
  }
  return { ...base, ok: false, error: 'no_path', from: fromInfo, to: toInfo };
}
