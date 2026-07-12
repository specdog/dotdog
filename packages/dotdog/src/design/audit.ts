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

function nodeName(node: any, index: number): string {
  return String(Array.isArray(node) ? node[0] ?? index : node.label || node.name || node.id || index);
}

function nodeKind(node: any): string {
  if (Array.isArray(node)) return node[1] === 'e' ? 'entity' : node[1] === 'p' ? 'prediction' : node[1] === 'i' ? 'infra' : String(node[1] || 'unknown');
  return String(node.kind || node.type || node.t || 'unknown').toLowerCase();
}

function properties(node: any): Record<string, string> {
  const raw = Array.isArray(node) ? node[2] || [] : node.properties || {};
  if (!Array.isArray(raw)) return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value)]));
  if (raw.length && Array.isArray(raw[0])) return Object.fromEntries(raw.map((pair: any[]) => [String(pair[0]), String(pair[1] ?? '')]));
  const result: Record<string, string> = {};
  for (let index = 0; index < raw.length; index += 2) result[String(raw[index])] = String(raw[index + 1] ?? '');
  return result;
}

function states(node: any): string[] {
  const raw = Array.isArray(node) ? node[3] : node.states;
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function entitiesAndEdges(dag: any): { nodes: DesignNode[]; edges: DesignEdge[] } {
  const rawNodes: any[] = dag?.nodes || dag?.n || (Array.isArray(dag) ? dag[2] : []) || [];
  const nodes = rawNodes.map((node, index) => ({ name: nodeName(node, index), kind: nodeKind(node), properties: properties(node), states: states(node) }));
  const byName = new Map(nodes.map((node) => [node.name.toLowerCase(), node.name]));
  const edges: DesignEdge[] = [];
  const add = (source: unknown, target: unknown, verb: unknown) => {
    const sourceName = byName.get(String(source || '').toLowerCase()) || String(source || '');
    const targetName = byName.get(String(target || '').toLowerCase()) || String(target || '');
    if (sourceName && targetName && verb) edges.push({ source: sourceName, target: targetName, verb: String(verb) });
  };
  if (Array.isArray(dag?.edges)) {
    for (const edge of dag.edges) add(edge.sourceId || edge.source, edge.targetId || edge.target, edge.verb || edge.type);
  } else {
    for (const [index, raw] of rawNodes.entries()) {
      const rawEdges = Array.isArray(raw) ? raw[4] || [] : raw.edges || raw.es || [];
      for (const edge of rawEdges) add(nodes[index].name, Array.isArray(edge) ? edge[0] : edge.targetId || edge.target, Array.isArray(edge) ? edge[1] : edge.verb || edge.type);
    }
  }
  const unique = new Map(edges.map((edge) => [`${edge.source}\0${edge.target}\0${edge.verb}`, edge]));
  return { nodes: nodes.filter((node) => node.kind === 'entity'), edges: [...unique.values()] };
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
