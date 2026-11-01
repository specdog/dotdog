import { normalizeGraph } from '../graph/model';

export type DesignSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type DesignFinding = {
  severity: DesignSeverity;
  code: string;
  entity?: string;
  message: string;
  nextStep: string;
};

export type DesignReport = {
  project: string;
  source: string;
  entities: number;
  relationships: number;
  findings: DesignFinding[];
  summary: { high: number; medium: number; low: number };
  ok: boolean;
};

type DesignNode = { name: string; kind: string; properties: Record<string, string>; states: string[] };
type DesignEdge = { source: string; target: string; verb: string };

function entitiesAndEdges(dag: unknown): { nodes: DesignNode[]; edges: DesignEdge[] } {
  const graph = normalizeGraph(dag);
  const byId = new Map(graph.nodes.map(node => [node.id, node.label]));
  return {
    nodes: graph.nodes.filter(node => node.kind === 'entity').map(node => ({ name: node.label, kind: node.kind, properties: Object.keys(node.schema).length ? node.schema : node.properties, states: node.states })),
    edges: graph.edges.map(edge => ({ source: byId.get(edge.sourceId)!, target: byId.get(edge.targetId)!, verb: edge.verb })),
  };
}

function finding(severity: DesignSeverity, code: string, entity: string | undefined, message: string, nextStep: string): DesignFinding {
  return { severity, code, ...(entity ? { entity } : {}), message, nextStep };
}

export function auditDesign(dag: unknown, project: string, source: string): DesignReport {
  const { nodes, edges } = entitiesAndEdges(dag);
  const findings: DesignFinding[] = [];
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  if (nodes.length > 1 && edges.length === 0) {
    findings.push(finding('HIGH', 'no_relationships', undefined, 'Multiple entities have no modeled relationships.', 'Define the relationships, cardinality, and ownership between the core entities.'));
  }
  for (const node of nodes) {
    const keys = Object.keys(node.properties).map((key) => key.toLowerCase());
    if (!keys.some((key) => key === 'id' || key === 'uuid' || key === 'key' || key.endsWith('_id'))) {
      findings.push(finding('MEDIUM', 'missing_identifier', node.name, 'No stable identifier is modeled.', 'Add an explicit id, uuid, key, or domain identifier and define its uniqueness.'));
    }
    if (!node.states.length) {
      findings.push(finding('MEDIUM', 'missing_lifecycle', node.name, 'No lifecycle states are modeled.', 'Define states and allowed transitions, or document why this entity is immutable.'));
    }
    if (!keys.some((key) => key === 'owner' || key === 'owner_id' || key === 'owned_by' || key === 'source_of_truth' || key === 'service')) {
      findings.push(finding('MEDIUM', 'missing_ownership', node.name, 'The source of truth or owning boundary is not modeled.', 'Name the owning service, team, or entity and identify the write authority.'));
    }
    if (!keys.some((key) => key === 'read' || key === 'reads' || key === 'write' || key === 'writes' || key === 'index' || key === 'query')) {
      findings.push(finding('LOW', 'missing_access_pattern', node.name, 'Primary access patterns are not modeled.', 'Document the important reads, writes, queries, or indexes before choosing storage.'));
    }
    const sensitive = keys.filter((key) => /email|phone|address|password|token|secret|ssn|birth/.test(key));
    if (sensitive.length && !keys.some((key) => key === 'sensitive' || key === 'classification' || key === 'pii' || key === 'retention')) {
      findings.push(finding('MEDIUM', 'unclassified_sensitive_data', node.name, `Potentially sensitive fields are unclassified: ${sensitive.join(', ')}.`, 'Mark sensitivity, retention, access rules, and deletion requirements explicitly.'));
    }
    if (nodes.length > 1 && !connected.has(node.name)) {
      findings.push(finding('MEDIUM', 'orphan_entity', node.name, 'Entity is disconnected from the rest of the model.', 'Link it to an owning workflow or remove it from the core model.'));
    }
  }
  findings.sort((a, b) => `${a.severity}:${a.code}:${a.entity || ''}`.localeCompare(`${b.severity}:${b.code}:${b.entity || ''}`));
  const summary = {
    high: findings.filter((item) => item.severity === 'HIGH').length,
    medium: findings.filter((item) => item.severity === 'MEDIUM').length,
    low: findings.filter((item) => item.severity === 'LOW').length,
  };
  return { project, source, entities: nodes.length, relationships: edges.length, findings, summary, ok: summary.high === 0 };
}
