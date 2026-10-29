import { isAbsolute } from 'path';

export type GraphNode = {
  id: string;
  label: string;
  kind: string;
  properties: Record<string, any>;
  schema: Record<string, any>;
  states: string[];
  lifecycle: string[];
  description?: string;
  source?: string;
  confidence?: string;
  origin?: Record<string, unknown>;
  evidence?: unknown;
};

export type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  verb: string;
  cardinality?: string;
  required?: boolean;
  confidence?: string;
  origin?: Record<string, unknown>;
  evidence?: unknown;
};

export type NormalizedGraph = {
  project: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  compiled: boolean;
  coverage?: unknown;
  limitations: string[];
};

function safeOrigin(origin: any): Record<string, unknown> | undefined {
  if (!origin || typeof origin !== 'object') return undefined;
  const result: Record<string, unknown> = {};
  for (const key of ['type', 'line', 'provider', 'digest']) {
    if (origin[key] !== undefined) result[key] = origin[key];
  }
  if (typeof origin.file === 'string' && !isAbsolute(origin.file)) result.file = origin.file;
  return Object.keys(result).length ? result : undefined;
}

function properties(value: any): Record<string, any> {
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null && typeof value !== 'object') throw new Error('Graph properties must be an object or key/value array');
    return value || {};
  }
  if (value.length % 2 && !(value.length && Array.isArray(value[0]))) throw new Error('Odd-length graph property array');
  if (value.length && Array.isArray(value[0])) return Object.fromEntries(value);
  return Object.fromEntries(Array.from({ length: value.length / 2 }, (_, i) => [String(value[i * 2]), value[i * 2 + 1]]));
}

export function normalizeGraph(dag: any): NormalizedGraph {
  if (!dag || typeof dag !== 'object') throw new Error('Expected a graph object or compiled DAG array');
  if (Array.isArray(dag) && dag[0] !== 3) throw new Error('Unsupported compact graph version');
  const rawNodes = Array.isArray(dag) ? dag[2] : dag.nodes ?? dag.n;
  if (!Array.isArray(rawNodes)) throw new Error('Graph nodes must be an array');
  if (rawNodes.length > 100000) throw new Error('Graph exceeds 100000 nodes');
  const compiled = Array.isArray(dag);
  const positional = !compiled && rawNodes.some((node: any) => Array.isArray(node) && typeof node[0] === 'number');
  const nodes: GraphNode[] = rawNodes.map((node: any, index: number) => {
    if (!node || typeof node !== 'object') throw new Error(`Invalid node at index ${index}`);
    if (Array.isArray(node)) {
      const rawLabel = node[positional ? 1 : 0];
      if (!['string', 'number'].includes(typeof rawLabel) || String(rawLabel) === '') throw new Error(`Missing node identity at index ${index}`);
      const label = String(rawLabel);
      const metadata = (positional ? node[8] : node[6]) || {};
      const type = positional ? node[2] : metadata.kind ?? ({ e: 'entity', p: 'prediction', i: 'infra' } as any)[node[1]];
      return {
        id: label, label, kind: type || 'entity',
        description: positional ? node[3] : metadata.description,
        properties: properties(node[positional ? 4 : 2]), schema: metadata.schema || {},
        states: node[positional ? 5 : 3] || [], lifecycle: metadata.lifecycle || [],
        confidence: 'certain', origin: { type: 'compiled' },
      };
    }
    const rawId = node.id ?? node.i ?? node.label;
    if (!['string', 'number'].includes(typeof rawId) || String(rawId) === '') throw new Error(`Missing node identity at index ${index}`);
    const id = String(rawId);
    return {
      id, label: String(node.label ?? node.name ?? node.i ?? id),
      kind: String(node.kind ?? node.type ?? node.t ?? node.g ?? 'entity'),
      properties: properties(node.properties ?? node.p), schema: node.schema || {},
      states: node.states ?? node.s ?? [], lifecycle: node.lifecycle ?? node.l ?? [],
      description: node.description ?? node.d, source: node.source,
      confidence: node.confidence, origin: safeOrigin(node.origin), evidence: node.evidence,
    };
  });
  const byIndex = new Map(nodes.map((node, index) => [index, node.id]));
  const ids = new Set(nodes.map(node => node.id));
  const labels = new Map<string, string[]>();
  for (const node of nodes) {
    if (!labels.has(node.label)) labels.set(node.label, []);
    labels.get(node.label)!.push(node.id);
  }
  const ref = (value: any) => {
    if (typeof value === 'number' && (compiled || positional)) return byIndex.get(value) ?? String(value);
    const key = String(value ?? '');
    if (ids.has(key)) return key;
    const matches = labels.get(key) || [];
    if (matches.length > 1) throw new Error(`Ambiguous edge endpoint: ${key}`);
    return matches[0] ?? key;
  };
  const edges: GraphEdge[] = [];
  const add = (source: any, target: any, verb: any, extra: any = {}) => {
    if (edges.length >= 500000) throw new Error('Graph exceeds 500000 edges');
    const sourceId = ref(source), targetId = ref(target);
    if (!sourceId || !targetId || !verb) throw new Error('Graph edge requires source, target, and verb');
    edges.push({ id: String(extra.id ?? `${sourceId}:${verb}:${targetId}`), sourceId, targetId, verb: String(verb),
      cardinality: extra.cardinality ?? extra.c, required: extra.required ?? extra.r,
      confidence: extra.confidence, origin: safeOrigin(extra.origin), evidence: extra.evidence });
  };
  const topEdges = dag.edges ?? dag.e;
  if (topEdges !== undefined && !Array.isArray(topEdges)) throw new Error('Graph edges must be an array');
  if (Array.isArray(topEdges)) {
    for (const edge of topEdges) add(edge.sourceId ?? edge.source ?? edge.s, edge.targetId ?? edge.target ?? edge.t, edge.verb ?? edge.type ?? edge.v, edge);
  } else {
    rawNodes.forEach((node: any, index: number) => {
      const outgoing = Array.isArray(node) ? node[positional ? 6 : 4] || [] : node.edges ?? node.es ?? [];
      for (const edge of outgoing) {
        if (Array.isArray(edge)) add(nodes[index].id, edge[0], edge[1], { cardinality: edge[2], required: Boolean(edge[3]), confidence: 'certain', origin: { type: 'compiled' } });
        else add(nodes[index].id, edge.targetId ?? edge.target ?? edge.t, edge.verb ?? edge.type ?? edge.v, edge);
      }
    });
  }
  const graph = {
    project: String(Array.isArray(dag) ? dag[1] : dag.project ?? dag.p ?? ''), nodes, edges, compiled,
    coverage: dag.coverage, limitations: Array.isArray(dag.limitations) ? dag.limitations : Array.isArray(dag.unknowns) ? dag.unknowns : [],
  };
  if (graph.limitations.some((item: unknown) => typeof item !== 'string')) throw new Error('Graph limitations must be strings');
  const errors = graphErrors(graph);
  if (errors.length) throw new Error(errors.join('; '));
  return graph;
}

export function graphErrors(graph: NormalizedGraph): string[] {
  const ids = new Set<string>(), edgeIds = new Set<string>(), errors: string[] = [];
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) errors.push(`Duplicate or empty node id: ${node.id}`);
    ids.add(node.id);
    if (!node.schema || typeof node.schema !== 'object' || Array.isArray(node.schema)) errors.push(`Invalid schema: ${node.id}`);
    if (!Array.isArray(node.states) || node.states.some(state => typeof state !== 'string')) errors.push(`Invalid states: ${node.id}`);
    if (!Array.isArray(node.lifecycle) || node.lifecycle.some(state => typeof state !== 'string')) errors.push(`Invalid lifecycle: ${node.id}`);
  }
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.sourceId) || !ids.has(edge.targetId)) errors.push(`Dangling edge: ${edge.id}`);
  }
  return errors;
}

export function graphNeighborhood(graph: NormalizedGraph, query: string, options: { direction?: 'incoming' | 'outgoing' | 'any'; depth?: number; limit?: number; verb?: string } = {}) {
  const byIdMatch = graph.nodes.filter(node => node.id === query);
  const exact = byIdMatch.length ? byIdMatch : graph.nodes.filter(node => node.label.toLowerCase() === query.toLowerCase() || node.id.toLowerCase() === query.toLowerCase());
  if (exact.length !== 1) return { ok: false, error: exact.length ? 'ambiguous_endpoint' : 'endpoint_not_found', candidates: exact.slice(0, 100).map(node => node.id), nodes: [], edges: [], truncated: false };
  const direction = options.direction || 'any', depth = options.depth ?? 2, limit = options.limit ?? 100;
  if (!Number.isInteger(depth) || depth < 0 || depth > 12 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('depth must be 0–12 and limit 1–1000');
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const adjacency = new Map<string, { edge: GraphEdge; next: string }[]>();
  const add = (id: string, next: string, edge: GraphEdge) => {
    if (!adjacency.has(id)) adjacency.set(id, []);
    adjacency.get(id)!.push({ edge, next });
  };
  for (const edge of graph.edges) {
    if (options.verb && options.verb !== edge.verb) continue;
    if (direction !== 'incoming') add(edge.sourceId, edge.targetId, edge);
    if (direction !== 'outgoing') add(edge.targetId, edge.sourceId, edge);
  }
  const visited = new Set([exact[0].id]), edges = new Map<string, GraphEdge>();
  const queue = [{ id: exact[0].id, depth: 0 }];
  let truncated = false;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.depth >= depth) continue;
    for (const item of adjacency.get(current.id) || []) {
      if (!visited.has(item.next)) {
        if (visited.size >= limit) { truncated = true; continue; }
        visited.add(item.next);
        queue.push({ id: item.next, depth: current.depth + 1 });
      }
      if (edges.size < limit * 4 || edges.has(item.edge.id)) edges.set(item.edge.id, item.edge);
      else truncated = true;
    }
  }
  return { ok: true, nodes: [...visited].map(id => byId.get(id)!), edges: [...edges.values()], truncated, direction, depth };
}
