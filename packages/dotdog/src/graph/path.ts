import { isAbsolute } from 'path';

export type PathDirection = 'outgoing' | 'incoming' | 'any';

type GraphNode = {
  id: string;
  label: string;
  kind?: string;
  confidence?: string;
  origin?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  verb: string;
  confidence?: string;
  origin?: Record<string, unknown>;
};

type NormalizedGraph = { nodes: GraphNode[]; edges: GraphEdge[]; compiled: boolean };

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

function compactKind(code: unknown): string {
  return code === 'p' ? 'prediction' : code === 'i' ? 'infra' : 'entity';
}

function safeOrigin(origin: unknown): Record<string, unknown> | undefined {
  if (!origin || typeof origin !== 'object') return undefined;
  const value = origin as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (typeof value.type === 'string') result.type = value.type;
  if (typeof value.line === 'number') result.line = value.line;
  if (typeof value.file === 'string' && !isAbsolute(value.file)) result.file = value.file;
  return Object.keys(result).length ? result : undefined;
}

function normalizeGraph(dag: any): NormalizedGraph {
  const rawNodes: any[] = dag?.nodes || dag?.n || (Array.isArray(dag) ? dag[2] : []) || [];
  const compiled = Array.isArray(dag);
  const nodes: GraphNode[] = rawNodes.map((node: any, index) => {
    if (Array.isArray(node)) {
      return { id: String(node[0] ?? index), label: String(node[0] ?? index), kind: compactKind(node[1]), confidence: 'certain', origin: { type: 'compiled' } };
    }
    const id = String(node.id || node.i || node.label || index);
    return {
      id,
      label: String(node.label || node.l || node.id || node.i || id),
      kind: String(node.kind || node.g || node.type || node.t || 'entity'),
      confidence: node.confidence,
      origin: safeOrigin(node.origin),
    };
  });
  const byIndex = new Map(rawNodes.map((node, index) => [index, nodes[index].id]));
  const byName = new Map(nodes.map((node) => [node.label.toLowerCase(), node.id]));
  const edges: GraphEdge[] = [];
  const addEdge = (sourceId: unknown, targetId: unknown, verb: unknown, extra: any = {}) => {
    const source = String(sourceId ?? '');
    const targetRef = typeof targetId === 'number' ? byIndex.get(targetId) || '' : String(targetId ?? '');
    const target = byName.get(targetRef.toLowerCase()) || targetRef;
    if (!source || !target || !verb) return;
    edges.push({
      id: String(extra.id || `${source}:${String(verb)}:${target}`),
      sourceId: source,
      targetId: target,
      verb: String(verb),
      confidence: extra.confidence,
      origin: safeOrigin(extra.origin),
    });
  };

  if (Array.isArray(dag?.edges)) {
    for (const edge of dag.edges) addEdge(edge.sourceId || edge.source, edge.targetId || edge.target, edge.verb || edge.type, edge);
  } else {
    for (const [index, node] of rawNodes.entries()) {
      const source = nodes[index].id;
      const rawEdges = Array.isArray(node) ? node[4] || [] : node.edges || node.es || [];
      for (const edge of rawEdges) {
        if (Array.isArray(edge)) addEdge(source, edge[0], edge[1], { confidence: 'certain', origin: { type: compiled ? 'compiled' : 'generated' } });
        else addEdge(source, edge.targetId || edge.target, edge.verb || edge.type, edge);
      }
    }
  }
  return { nodes, edges, compiled };
}

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
  const graph = normalizeGraph(dag);
  const from = endpoint(graph, fromQuery);
  const to = endpoint(graph, toQuery);
  const base = { direction, hops: 0, nodes: [], edges: [] } as GraphPathResult;
  if (!from.node) return { ...base, ok: false, error: from.candidates ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: from.candidates };
  if (!to.node) return { ...base, ok: false, error: to.candidates ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: to.candidates };
  const fromInfo = { query: fromQuery, id: from.node.id, label: from.node.label };
  const toInfo = { query: toQuery, id: to.node.id, label: to.node.label };
  const maxHops = Math.min(Math.max(Number(options.maxHops || 8), 1), 12);
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
