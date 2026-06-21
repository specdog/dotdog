import { readFileSync } from 'fs';
import type { RepositoryWorldModel, WorldEdge, WorldNode, WorldPrediction } from './schema';

export type WorldQueryResult = {
  nodes: WorldNode[];
  edges: WorldEdge[];
  predictions: WorldPrediction[];
  unknowns: string[];
};

export type WorldTrace = {
  node: WorldNode;
  incoming: WorldEdge[];
  outgoing: WorldEdge[];
  neighbors: WorldNode[];
  predictions: WorldPrediction[];
};

function haystack(node: WorldNode): string {
  const props = node.properties ? JSON.stringify(node.properties) : '';
  return `${node.id} ${node.kind} ${node.label} ${node.source} ${node.description || ''} ${props}`.toLowerCase();
}

export function loadWorldModel(path: string): RepositoryWorldModel {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== '0.1' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`Not a dotdog repo.dag file: ${path}`);
  }
  return parsed as RepositoryWorldModel;
}

export function queryWorldModel(model: RepositoryWorldModel, query: string, limit = 20): WorldQueryResult {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every((term) => text.includes(term));

  const nodes = model.nodes.filter((node) => matches(haystack(node))).slice(0, limit);
  const nodeIds = new Set(nodes.map((node) => node.id));

  const edges = model.edges
    .filter((edge) => nodeIds.has(edge.sourceId) || nodeIds.has(edge.targetId))
    .slice(0, limit * 2);

  const predictions = model.predictions
    .filter((prediction) => prediction.affectedNodes.some((id) => nodeIds.has(id)))
    .slice(0, limit);

  const unknowns = model.unknowns
    .filter((unknown) => matches(unknown.toLowerCase()))
    .slice(0, limit);

  return { nodes, edges, predictions, unknowns };
}

export function traceWorldNode(model: RepositoryWorldModel, idOrLabel: string): WorldTrace | null {
  const needle = idOrLabel.toLowerCase();
  const node = model.nodes.find((candidate) =>
    candidate.id.toLowerCase() === needle ||
    candidate.label.toLowerCase() === needle ||
    candidate.label.toLowerCase().includes(needle)
  );

  if (!node) return null;

  const incoming = model.edges.filter((edge) => edge.targetId === node.id);
  const outgoing = model.edges.filter((edge) => edge.sourceId === node.id);
  const neighborIds = new Set([...incoming.map((edge) => edge.sourceId), ...outgoing.map((edge) => edge.targetId)]);
  const neighbors = model.nodes.filter((candidate) => neighborIds.has(candidate.id));
  const predictions = model.predictions.filter((prediction) => prediction.affectedNodes.includes(node.id));

  return { node, incoming, outgoing, neighbors, predictions };
}

export function formatQueryResult(result: WorldQueryResult): string {
  const lines: string[] = [];

  if (result.nodes.length) {
    lines.push('Nodes');
    for (const node of result.nodes) {
      lines.push(`- ${node.id} [${node.kind}/${node.confidence}] ${node.source}`);
    }
  }

  if (result.edges.length) {
    lines.push('Edges');
    for (const edge of result.edges) {
      lines.push(`- ${edge.sourceId} --${edge.verb}/${edge.confidence}--> ${edge.targetId}`);
    }
  }

  if (result.predictions.length) {
    lines.push('Predictions');
    for (const prediction of result.predictions) {
      lines.push(`- ${prediction.id} [${prediction.confidence}] ${prediction.trigger} => ${prediction.outcome}`);
    }
  }

  if (result.unknowns.length) {
    lines.push('Unknowns');
    for (const unknown of result.unknowns) {
      lines.push(`- ${unknown}`);
    }
  }

  return lines.length ? lines.join('\n') : 'No DAG matches.';
}

export function formatTrace(trace: WorldTrace | null): string {
  if (!trace) return 'No DAG node found.';

  const lines: string[] = [];
  lines.push(`${trace.node.id} [${trace.node.kind}/${trace.node.confidence}]`);
  lines.push(`source: ${trace.node.source}`);

  if (trace.node.description) {
    lines.push(`description: ${trace.node.description}`);
  }

  if (trace.incoming.length) {
    lines.push('Incoming');
    for (const edge of trace.incoming) {
      lines.push(`- ${edge.sourceId} --${edge.verb}--> ${edge.targetId}`);
    }
  }

  if (trace.outgoing.length) {
    lines.push('Outgoing');
    for (const edge of trace.outgoing) {
      lines.push(`- ${edge.sourceId} --${edge.verb}--> ${edge.targetId}`);
    }
  }

  if (trace.predictions.length) {
    lines.push('Predictions');
    for (const prediction of trace.predictions) {
      lines.push(`- ${prediction.trigger} => ${prediction.outcome}`);
    }
  }

  return lines.join('\n');
}
