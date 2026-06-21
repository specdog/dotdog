export type Confidence = 'certain' | 'likely' | 'unknown';

export type WorldNodeKind =
  | 'file'
  | 'symbol'
  | 'command'
  | 'package'
  | 'spec'
  | 'test'
  | 'doc'
  | 'build'
  | 'output'
  | 'external'
  | 'unknown';

export type WorldEdgeVerb =
  | 'imports'
  | 'exports'
  | 'defines'
  | 'mentions'
  | 'tests'
  | 'builds'
  | 'documents'
  | 'depends_on'
  | 'generated_by'
  | 'changed_with'
  | 'conflicts_with';

export type WorldNode = {
  id: string;
  kind: WorldNodeKind;
  label: string;
  source: string;
  hash?: string;
  description?: string;
  properties?: Record<string, string | number | boolean | string[]>;
  confidence: Confidence;
};

export type WorldEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  verb: WorldEdgeVerb;
  confidence: Confidence;
  source?: string;
  description?: string;
};

export type WorldPrediction = {
  id: string;
  trigger: string;
  outcome: string;
  affectedNodes: string[];
  requiredChecks: string[];
  confidence: Confidence;
};

export type RepositoryWorldModel = {
  version: '0.1';
  project: string;
  root: string;
  generatedAt: string;
  nodes: WorldNode[];
  edges: WorldEdge[];
  predictions: WorldPrediction[];
  unknowns: string[];
};

const NODE_KINDS = new Set<WorldNodeKind>([
  'file',
  'symbol',
  'command',
  'package',
  'spec',
  'test',
  'doc',
  'build',
  'output',
  'external',
  'unknown',
]);

const EDGE_VERBS = new Set<WorldEdgeVerb>([
  'imports',
  'exports',
  'defines',
  'mentions',
  'tests',
  'builds',
  'documents',
  'depends_on',
  'generated_by',
  'changed_with',
  'conflicts_with',
]);

const CONFIDENCE = new Set<Confidence>(['certain', 'likely', 'unknown']);

export function stableId(...parts: string[]): string {
  return parts
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function makeNode(input: Omit<WorldNode, 'id' | 'confidence'> & { id?: string; confidence?: Confidence }): WorldNode {
  const kind = NODE_KINDS.has(input.kind) ? input.kind : 'unknown';
  return {
    id: input.id || stableId(kind, input.source, input.label),
    kind,
    label: input.label,
    source: input.source,
    hash: input.hash,
    description: input.description,
    properties: input.properties,
    confidence: input.confidence || 'certain',
  };
}

export function makeEdge(input: Omit<WorldEdge, 'id' | 'confidence'> & { id?: string; confidence?: Confidence }): WorldEdge {
  const verb = EDGE_VERBS.has(input.verb) ? input.verb : 'depends_on';
  return {
    id: input.id || stableId(input.sourceId, verb, input.targetId),
    sourceId: input.sourceId,
    targetId: input.targetId,
    verb,
    confidence: input.confidence || 'certain',
    source: input.source,
    description: input.description,
  };
}

export function sortWorldModel(model: RepositoryWorldModel): RepositoryWorldModel {
  return {
    ...model,
    nodes: [...model.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...model.edges].sort((a, b) => a.id.localeCompare(b.id)),
    predictions: [...model.predictions].sort((a, b) => a.id.localeCompare(b.id)),
    unknowns: [...model.unknowns].sort((a, b) => a.localeCompare(b)),
  };
}

export function validateWorldModel(model: RepositoryWorldModel): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(model.nodes.map((node) => node.id));

  for (const node of model.nodes) {
    if (!node.id) errors.push('node missing id');
    if (!NODE_KINDS.has(node.kind)) errors.push(`node ${node.id} has invalid kind ${node.kind}`);
    if (!CONFIDENCE.has(node.confidence)) errors.push(`node ${node.id} has invalid confidence ${node.confidence}`);
  }

  for (const edge of model.edges) {
    if (!edge.id) errors.push('edge missing id');
    if (!EDGE_VERBS.has(edge.verb)) errors.push(`edge ${edge.id} has invalid verb ${edge.verb}`);
    if (!nodeIds.has(edge.sourceId)) errors.push(`edge ${edge.id} missing source node ${edge.sourceId}`);
    if (!nodeIds.has(edge.targetId)) errors.push(`edge ${edge.id} missing target node ${edge.targetId}`);
    if (!CONFIDENCE.has(edge.confidence)) errors.push(`edge ${edge.id} has invalid confidence ${edge.confidence}`);
  }

  for (const prediction of model.predictions) {
    if (!prediction.id) errors.push('prediction missing id');
    if (!CONFIDENCE.has(prediction.confidence)) errors.push(`prediction ${prediction.id} has invalid confidence ${prediction.confidence}`);
    for (const nodeId of prediction.affectedNodes) {
      if (!nodeIds.has(nodeId)) errors.push(`prediction ${prediction.id} references missing node ${nodeId}`);
    }
  }

  return errors;
}

export function serializeWorldModel(model: RepositoryWorldModel): string {
  return `${JSON.stringify(sortWorldModel(model), null, 2)}\n`;
}
