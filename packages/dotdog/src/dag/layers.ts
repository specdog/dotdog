import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from '../parser';
import {
  makeEdge,
  makeNode,
  serializeWorldModel,
  stableId,
  type RepositoryWorldModel,
  type WorldEdge,
  type WorldEdgeVerb,
  type WorldNode,
  type WorldNodeKind,
} from './schema';

export type LayerCompileResult = {
  file: string;
  nodes: number;
  edges: number;
  unknowns: number;
};

function nodeKindFromType(type = ''): WorldNodeKind {
  const t = type.toLowerCase();
  if (t === 'file') return 'file';
  if (t === 'symbol' || t === 'route' || t === 'component') return 'symbol';
  if (t === 'command') return 'command';
  if (t === 'package' || t === 'repo') return 'package';
  if (t === 'spec') return 'spec';
  if (t === 'test') return 'test';
  if (t === 'doc') return 'doc';
  if (t === 'build' || t === 'ci') return 'build';
  if (t === 'output') return 'output';
  if (t === 'unknown') return 'unknown';
  return 'external';
}

function edgeVerbFrom(verb = ''): WorldEdgeVerb {
  const v = verb.toLowerCase();
  if (v === 'imports') return 'imports';
  if (v === 'exports') return 'exports';
  if (v === 'defines') return 'defines';
  if (v === 'mentions') return 'mentions';
  if (v === 'tests' || v === 'tested_by') return 'tests';
  if (v === 'builds') return 'builds';
  if (v === 'documents' || v === 'documented_by') return 'documents';
  if (v === 'includes') return 'includes';
  if (v === 'implements') return 'implements';
  if (v === 'configured_by') return 'configured_by';
  if (v === 'deployed_by') return 'deployed_by';
  if (v === 'requires' || v === 'requires_env') return 'requires';
  if (v === 'supports') return 'supports';
  if (v === 'generated_by') return 'generated_by';
  if (v === 'changed_with') return 'changed_with';
  if (v === 'conflicts_with') return 'conflicts_with';
  return 'depends_on';
}

function idForLabel(label: string, kind: WorldNodeKind = 'external'): string {
  if (label === 'repository') return 'repository';
  if (label.startsWith('file:')) return stableId('file', label.replace(/^file:/, ''));
  if (label.startsWith('package:')) return stableId('package', label.replace(/^package:/, ''));
  if (label.startsWith('route:')) return stableId('symbol', label.replace(/^route:/, ''));
  return stableId(kind, label);
}

function compactProperties(block: any): Record<string, string> {
  const props: Record<string, string> = {};
  const raw = block?.yaml?.properties || block?.properties || {};
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (value && typeof value === 'object' && 'default' in value) props[key] = String(value.default);
    else if (typeof value === 'string') props[key] = value;
  }
  return props;
}

function readGeneratedWorld(file: string, project: string, root: string): RepositoryWorldModel {
  if (!existsSync(file)) {
    return { version: '0.1', project, root, generatedAt: new Date().toISOString(), nodes: [], edges: [], predictions: [], unknowns: [] };
  }
  const parsed = JSON.parse(readFileSync(file, 'utf-8'));
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`Unsupported generated DAG format: ${file}`);
  }
  return {
    version: '0.1',
    project: parsed.project || project,
    root: parsed.root || root,
    generatedAt: new Date().toISOString(),
    nodes: parsed.nodes.map((node: WorldNode) => ({ ...node, origin: node.origin || { type: 'generated', file: node.source } })),
    edges: parsed.edges.map((edge: WorldEdge) => ({ ...edge, origin: edge.origin || { type: 'generated', file: edge.source } })),
    predictions: parsed.predictions || [],
    unknowns: parsed.unknowns || [],
  };
}

function loadDogLayer(dir: string, originType: 'semantic' | 'overlay', labelToId: Map<string, string>): { nodes: WorldNode[]; edges: WorldEdge[]; unknowns: string[] } {
  const nodes: WorldNode[] = [];
  const edges: WorldEdge[] = [];
  const unknowns: string[] = [];
  if (!existsSync(dir)) return { nodes, edges, unknowns };

  const files = readdirSync(dir).filter((file) => file.endsWith('.dog')).sort();
  for (const file of files) {
    const fullPath = join(dir, file);
    const ast = parse(readFileSync(fullPath, 'utf-8'));

    for (const section of ast.sections) {
      for (const block of section.blocks) {
        if (block.kind !== 'entity' && block.kind !== 'event') continue;
        const name = (block as any).name || '';
        if (!name) continue;
        const kind = nodeKindFromType((block as any).type || 'external');
        const id = idForLabel(name, kind);
        labelToId.set(name, id);
        nodes.push(makeNode({
          id,
          kind,
          label: name,
          source: fullPath,
          description: (block as any).description || '',
          properties: compactProperties(block),
          confidence: 'certain',
          origin: { type: originType, file: fullPath },
        }));
      }
    }

    for (const section of ast.sections) {
      for (const block of section.blocks) {
        if (block.kind !== 'relationship') continue;
        const sourceLabel = (block as any).source || '';
        const targetLabel = (block as any).target || '';
        if (!sourceLabel || !targetLabel) continue;
        let sourceId = labelToId.get(sourceLabel);
        let targetId = labelToId.get(targetLabel);
        if (!sourceId) {
          sourceId = idForLabel(sourceLabel, 'unknown');
          labelToId.set(sourceLabel, sourceId);
          nodes.push(makeNode({ id: sourceId, kind: 'unknown', label: sourceLabel, source: fullPath, description: 'Referenced by authored graph but not found', confidence: 'unknown', origin: { type: originType, file: fullPath } }));
          unknowns.push(`${sourceLabel} referenced by ${file}`);
        }
        if (!targetId) {
          targetId = idForLabel(targetLabel, 'unknown');
          labelToId.set(targetLabel, targetId);
          nodes.push(makeNode({ id: targetId, kind: 'unknown', label: targetLabel, source: fullPath, description: 'Referenced by authored graph but not found', confidence: 'unknown', origin: { type: originType, file: fullPath } }));
          unknowns.push(`${targetLabel} referenced by ${file}`);
        }
        edges.push(makeEdge({
          sourceId,
          targetId,
          verb: edgeVerbFrom((block as any).verb || ''),
          description: (block as any).description || '',
          source: fullPath,
          confidence: 'certain',
          origin: { type: originType, file: fullPath },
        }));
      }
    }
  }

  return { nodes, edges, unknowns };
}

export function compileDotdogLayers(root: string, project: string): LayerCompileResult | null {
  const dotdogDir = join(root, '.dotdog');
  const generatedFile = join(dotdogDir, 'generated', 'repo.dag');
  const semanticDir = join(dotdogDir, 'semantic');
  const overlayDir = join(dotdogDir, 'overlays');
  if (!existsSync(generatedFile) && !existsSync(semanticDir) && !existsSync(overlayDir)) return null;

  const base = readGeneratedWorld(generatedFile, project, root);
  const labelToId = new Map<string, string>();
  const nodesById = new Map<string, WorldNode>();
  const edgesById = new Map<string, WorldEdge>();

  for (const node of base.nodes) {
    nodesById.set(node.id, node);
    labelToId.set(node.label, node.id);
    labelToId.set(node.id, node.id);
  }
  for (const edge of base.edges) edgesById.set(edge.id, edge);

  const semantic = loadDogLayer(semanticDir, 'semantic', labelToId);
  const overlay = loadDogLayer(overlayDir, 'overlay', labelToId);

  for (const node of [...semantic.nodes, ...overlay.nodes]) nodesById.set(node.id, node);
  for (const edge of [...semantic.edges, ...overlay.edges]) edgesById.set(edge.id, edge);

  const compiled: RepositoryWorldModel = {
    version: '0.1',
    project,
    root,
    generatedAt: new Date().toISOString(),
    nodes: [...nodesById.values()],
    edges: [...edgesById.values()],
    predictions: base.predictions || [],
    unknowns: [...base.unknowns, ...semantic.unknowns, ...overlay.unknowns],
  };

  const compiledDir = join(dotdogDir, 'compiled');
  mkdirSync(compiledDir, { recursive: true });
  const outFile = join(compiledDir, 'repo.dag');
  writeFileSync(outFile, serializeWorldModel(compiled));

  return { file: outFile, nodes: compiled.nodes.length, edges: compiled.edges.length, unknowns: compiled.unknowns.length };
}
