import type { GraphEdge, GraphNode } from './model';

type Context = {
  ok: boolean;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  candidates?: string[];
  truncated?: boolean;
  error?: string;
  direction?: string;
  depth?: number;
};

const words = (text: string) => new Set(text.slice(0, 4096).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

export async function budgetContext(context: Context, maxTokens: number, task = '') {
  if (!Number.isInteger(maxTokens) || maxTokens < 128 || maxTokens > 131072) throw new Error('maxTokens must be an integer from 128 to 131072');
  if (task.length > 4096) throw new Error('task must be at most 4096 characters');
  const { countTokens, isWithinTokenLimit } = await import('gpt-tokenizer/encoding/o200k_base');
  const count = (value: unknown) => countTokens(JSON.stringify(value), { disallowedSpecial: new Set() });
  const fits = (value: unknown) => isWithinTokenLimit(JSON.stringify(value), maxTokens, { disallowedSpecial: new Set() }) !== false;
  const budget = { maxTokens, encoding: 'o200k_base', tokenizer: 'gpt-tokenizer@4.1.0', scope: 'compact-json-text', excludes: 'MCP envelope, structured-content duplication, chat framing and other messages' };
  if (!context.ok) {
    const candidates = [...(context.candidates || [])];
    const result = { ok: false, error: context.error || 'endpoint_not_found', nodes: [], edges: [], truncated: true, candidates, budget, omittedCandidates: 0 };
    while (candidates.length && !fits(result)) {
      candidates.splice(Math.floor(candidates.length / 2));
      result.omittedCandidates = (context.candidates?.length || 0) - candidates.length;
    }
    return result;
  }
  const nodes = context.nodes || [], edges = context.edges || [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const selected = new Set<string>(), selectedEdges = new Set<string>();
  const payload = () => ({ ...context, nodes: nodes.filter(node => selected.has(node.id)), edges: edges.filter(edge => selectedEdges.has(edge.id)),
    truncated: Boolean(context.truncated || selected.size < nodes.length || selectedEdges.size < edges.length), budget,
    omitted: { nodes: nodes.length - selected.size, edges: edges.length - selectedEdges.size } });
  for (const node of nodes) selected.add(node.id);
  for (const edge of edges) selectedEdges.add(edge.id);
  if (fits(payload())) return payload();
  selected.clear(); selectedEdges.clear();
  if (!nodes.length) return payload();
  const root = nodes[0].id;
  selected.add(root);
  const minimumTokens = count(payload());
  if (minimumTokens > maxTokens) return { ok: false, error: 'budget_too_small', nodes: [], edges: [], truncated: true, budget, minimumTokens };
  const adjacency = new Map<string, { next: string; edge: GraphEdge }[]>();
  const add = (id: string, next: string, edge: GraphEdge) => {
    if (!adjacency.has(id)) adjacency.set(id, []);
    adjacency.get(id)!.push({ next, edge });
  };
  for (const edge of edges) {
    if (context.direction !== 'incoming') add(edge.sourceId, edge.targetId, edge);
    if (context.direction !== 'outgoing') add(edge.targetId, edge.sourceId, edge);
  }
  const parents = new Map<string, { previous: string; edge: GraphEdge; depth: number }>();
  const queue = [root], visited = new Set([root]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i], depth = parents.get(current)?.depth || 0;
    for (const item of adjacency.get(current) || []) {
      if (visited.has(item.next) || !nodeById.has(item.next)) continue;
      visited.add(item.next); parents.set(item.next, { previous: current, edge: item.edge, depth: depth + 1 }); queue.push(item.next);
    }
  }
  const terms = words(task);
  const relevance = (node: GraphNode) => {
    let score = 0;
    for (const [text, weight] of [[node.label, 8], [node.source || '', 4], [node.description || '', 2]] as const) {
      for (const term of words(text)) if (terms.has(term)) score += weight;
    }
    return score;
  };
  const ranked = nodes.map((node, order) => ({ node, order, score: relevance(node), depth: parents.get(node.id)?.depth ?? Infinity }))
    .filter(item => item.node.id !== root && parents.has(item.node.id))
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.order - b.order);
  for (const { node } of ranked) {
    if (selected.has(node.id)) continue;
    const addedNodes: string[] = [], addedEdges: string[] = [];
    let id = node.id;
    while (!selected.has(id)) {
      selected.add(id); addedNodes.push(id);
      const parent = parents.get(id)!;
      if (!selectedEdges.has(parent.edge.id)) { selectedEdges.add(parent.edge.id); addedEdges.push(parent.edge.id); }
      id = parent.previous;
    }
    if (!fits(payload())) {
      for (const id of addedNodes) selected.delete(id);
      for (const id of addedEdges) selectedEdges.delete(id);
    }
  }
  for (const edge of edges) {
    if (selectedEdges.has(edge.id) || !selected.has(edge.sourceId) || !selected.has(edge.targetId)) continue;
    selectedEdges.add(edge.id);
    if (!fits(payload())) selectedEdges.delete(edge.id);
  }
  return payload();
}
