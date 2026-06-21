import {
  makeEdge,
  makeNode,
  serializeWorldModel,
  stableId,
  type RepositoryWorldModel,
  type WorldEdgeVerb,
  type WorldNodeKind,
} from './schema';

export type RepoWorldFactInput = {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, string>;
};

export type RepoWorldEdgeInput = {
  source: string;
  target: string;
  verb: string;
};

export type RepoWorldMapInput = {
  facts: RepoWorldFactInput[];
  edges: RepoWorldEdgeInput[];
  files: string[];
};

function normalizeNodeKind(type: string): WorldNodeKind {
  const t = type.toLowerCase();
  if (t === 'repo') return 'package';
  if (t === 'manifest' || t === 'lockfile') return 'package';
  if (t === 'ci_workflow') return 'build';
  if (t === 'test') return 'test';
  if (t === 'doc') return 'doc';
  if (t === 'schema') return 'spec';
  if (t === 'component' || t === 'api_route' || t === 'page_route') return 'symbol';
  if (t === 'env') return 'external';
  if (t === 'package') return 'package';
  return 'file';
}

function normalizeEdgeVerb(verb: string): WorldEdgeVerb {
  const v = verb.toLowerCase();
  if (v === 'imports') return 'imports';
  if (v === 'exports') return 'exports';
  if (v === 'defines' || v === 'implements') return 'defines';
  if (v === 'mentions') return 'mentions';
  if (v === 'tested_by' || v === 'tests') return 'tests';
  if (v === 'deployed_by' || v === 'builds') return 'builds';
  if (v === 'documented_by' || v === 'documents') return 'documents';
  if (v === 'generated_by') return 'generated_by';
  if (v === 'changed_with') return 'changed_with';
  if (v === 'conflicts_with') return 'conflicts_with';
  return 'depends_on';
}

function factId(name: string, type: string): string {
  if (name === 'repository') return 'repository';
  const normalizedName = name.replace(/^(file|package|route):/, '');
  return stableId(normalizeNodeKind(type), normalizedName);
}

export function buildRepositoryWorldModel(project: string, root: string, map: RepoWorldMapInput): RepositoryWorldModel {
  const factIdByName = new Map<string, string>();
  const nodes = map.facts.map((fact) => {
    const id = factId(fact.name, fact.type);
    factIdByName.set(fact.name, id);
    return makeNode({
      id,
      kind: normalizeNodeKind(fact.type),
      label: fact.name,
      source: fact.properties?.path || root,
      description: fact.description,
      properties: fact.properties,
      confidence: 'certain',
    });
  });

  const existingNodeIds = new Set(nodes.map((node) => node.id));

  for (const edge of map.edges) {
    const sourceId = factIdByName.get(edge.source);
    const targetId = factIdByName.get(edge.target);
    if (!sourceId && !existingNodeIds.has(stableId('unknown', edge.source))) {
      nodes.push(makeNode({
        id: stableId('unknown', edge.source),
        kind: 'unknown',
        label: edge.source,
        source: root,
        description: 'Referenced by an edge but not mapped as a known node',
        confidence: 'unknown',
      }));
    }
    if (!targetId && !existingNodeIds.has(stableId('unknown', edge.target))) {
      nodes.push(makeNode({
        id: stableId('unknown', edge.target),
        kind: 'unknown',
        label: edge.target,
        source: root,
        description: 'Referenced by an edge but not mapped as a known node',
        confidence: 'unknown',
      }));
    }
  }

  const edges = map.edges.map((edge) => makeEdge({
    sourceId: factIdByName.get(edge.source) || stableId('unknown', edge.source),
    targetId: factIdByName.get(edge.target) || stableId('unknown', edge.target),
    verb: normalizeEdgeVerb(edge.verb),
    confidence: 'certain',
    source: root,
  }));

  return {
    version: '0.1',
    project,
    root,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    predictions: [],
    unknowns: [],
  };
}

export function renderRepositoryDag(project: string, root: string, map: RepoWorldMapInput): string {
  return serializeWorldModel(buildRepositoryWorldModel(project, root, map));
}
