// Spec Engine — core types and parser for .spec.md files
// This is the foundation everything else builds on.

import { z } from 'zod';

// --- Types ---

export const SpecEntitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  properties: z.record(z.object({
    type: z.string(),
    required: z.boolean().default(true),
    default: z.unknown().optional(),
    constraints: z.string().optional(),
    example: z.string().optional(),
  })).default({}),
  states: z.array(z.string()).default([]),
  lifecycle: z.string().optional(),
  cardinality: z.string().optional(),
});

export const SpecRelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  verb: z.string(),
  cardinality: z.string().optional(),
  required: z.boolean().default(false),
  cascade: z.string().optional(),
  invariants: z.string().optional(),
  example: z.string().optional(),
});

export const SpecEventSchema = z.object({
  name: z.string(),
  trigger: z.string().optional(),
  payload: z.record(z.string()).default({}),
  preconditions: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  sideEffects: z.array(z.string()).default([]),
  probability: z.number().nullable().default(null),
  frequency: z.string().optional(),
});

export const SpecConstraintSchema = z.object({
  name: z.string(),
  type: z.string(),
  statement: z.string(),
  enforcement: z.string().default('strict'),
  violationConsequence: z.string().optional(),
});

export const SpecCapabilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  actor: z.string().optional(),
  inputs: z.record(z.string()).default({}),
  outputs: z.record(z.string()).default({}),
  preconditions: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  errorStates: z.array(z.string()).default([]),
  example: z.string().optional(),
});

export const SpecScreenSchema = z.object({
  name: z.string(),
  content: z.string(), // ASCII art
  states: z.array(z.string()).default(['default']),
});

export const SpecFlowSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()).default([]),
});

export const SpecUserStorySchema = z.object({
  id: z.string(),
  story: z.string(),
  priority: z.string().default('P1'),
  acceptance: z.string(),
});

export const SpecFailureSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  cause: z.string().optional(),
  probability: z.number().optional(),
  impact: z.string().optional(),
  detection: z.string().optional(),
  recovery: z.string().optional(),
  prevention: z.string().optional(),
});

export const SpecEdgeCaseSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  expectedBehavior: z.string().optional(),
  test: z.string().optional(),
});

export const SpecAssumptionSchema = z.object({
  statement: z.string(),
  confidence: z.string().default('medium'),
  basis: z.string().optional(),
  falsifiable: z.boolean().default(true),
  test: z.string().optional(),
  ifWrong: z.string().optional(),
});

export const SpecPredictionSchema = z.object({
  name: z.string(),
  statement: z.string(),
  trigger: z.string().optional(),
  timeframe: z.string().optional(),
  confidence: z.number().optional(),
  measurement: z.string().optional(),
  actual: z.string().default('pending'),
  notes: z.string().optional(),
});

export const SpecScenarioSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  initialState: z.string().optional(),
  steps: z.array(z.string()).default([]),
  predictedOutcome: z.string().optional(),
  failureConditions: z.string().optional(),
});

// --- The complete spec genome ---

export const SpecGenomeSchema = z.object({
  name: z.string().default('untitled'),
  version: z.string().default('0.1.0'),
  purpose: z.string().default(''),
  // World model
  entities: z.array(SpecEntitySchema).default([]),
  relationships: z.array(SpecRelationshipSchema).default([]),
  events: z.array(SpecEventSchema).default([]),
  // Behavior
  capabilities: z.array(SpecCapabilitySchema).default([]),
  constraints: z.array(SpecConstraintSchema).default([]),
  // Screens & flows (from SPEC.md)
  screens: z.array(SpecScreenSchema).default([]),
  flows: z.array(SpecFlowSchema).default([]),
  userStories: z.array(SpecUserStorySchema).default([]),
  // Failure
  failures: z.array(SpecFailureSchema).default([]),
  edgeCases: z.array(SpecEdgeCaseSchema).default([]),
  // Uncertainty
  assumptions: z.array(SpecAssumptionSchema).default([]),
  predictions: z.array(SpecPredictionSchema).default([]),
  scenarios: z.array(SpecScenarioSchema).default([]),
  // Constitution
  constitution: z.record(z.string()).default({}),
});

export type SpecGenome = z.infer<typeof SpecGenomeSchema>;
export type SpecEntity = z.infer<typeof SpecEntitySchema>;
export type SpecRelationship = z.infer<typeof SpecRelationshipSchema>;
export type SpecEvent = z.infer<typeof SpecEventSchema>;
export type SpecCapability = z.infer<typeof SpecCapabilitySchema>;
export type SpecConstraint = z.infer<typeof SpecConstraintSchema>;
export type SpecScreen = z.infer<typeof SpecScreenSchema>;
export type SpecFlow = z.infer<typeof SpecFlowSchema>;
export type SpecUserStory = z.infer<typeof SpecUserStorySchema>;
export type SpecFailure = z.infer<typeof SpecFailureSchema>;
export type SpecEdgeCase = z.infer<typeof SpecEdgeCaseSchema>;
export type SpecAssumption = z.infer<typeof SpecAssumptionSchema>;
export type SpecPrediction = z.infer<typeof SpecPredictionSchema>;
export type SpecScenario = z.infer<typeof SpecScenarioSchema>;

// --- Validation ---

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number; // 0.0 - 1.0
}

export interface ValidationError {
  file: string;
  rule: string;
  message: string;
  line?: number;
}

export interface ValidationWarning {
  file: string;
  rule: string;
  message: string;
  line?: number;
}

// --- Ontology Vocabulary ---

/** Controlled vocabulary of valid entity types (OMD-GraphRAG principle: 10-30 types) */
export const ONTOLOGY_ENTITY_TYPES = [
  'entity',
  'relationship',
  'event',
  'capability',
  'constraint',
  'screen',
  'flow',
  'user_story',
  'task',
  'failure',
  'edge_case',
  'assumption',
  'prediction',
  'scenario',
  'node',
  'edge',
  'vector',
] as const;

export type OntologyEntityType = (typeof ONTOLOGY_ENTITY_TYPES)[number];

// --- Graph Traversal ---

export interface SpecGraph {
  nodes: Map<string, { name: string; description: string }>;
  edges: Array<{ from: string; to: string; verb: string }>;
  adjacency: Map<string, Set<string>>;
}

/** Build an in-memory graph from entities and relationships */
export function buildGraph(
  entities: SpecEntity[],
  relationships: SpecRelationship[]
): SpecGraph {
  const nodes = new Map<string, { name: string; description: string }>();
  const adjacency = new Map<string, Set<string>>();

  for (const entity of entities) {
    nodes.set(entity.name, {
      name: entity.name,
      description: entity.description || '',
    });
    adjacency.set(entity.name, new Set());
  }

  for (const rel of relationships) {
    if (!adjacency.has(rel.from)) adjacency.set(rel.from, new Set());
    if (!adjacency.has(rel.to)) adjacency.set(rel.to, new Set());
    adjacency.get(rel.from)?.add(rel.to);
    adjacency.get(rel.to)?.add(rel.from); // undirected for BFS
  }

  return { nodes, edges: relationships, adjacency };
}

/** BFS to find max hop depth from root entities */
export function auditHopDepth(graph: SpecGraph): Map<string, number> {
  const depths = new Map<string, number>();

  // Find root nodes (entities with no incoming edges)
  const hasIncoming = new Set<string>();
  for (const edge of graph.edges) {
    hasIncoming.add(edge.to);
  }
  const roots = [...graph.nodes.keys()].filter((n) => !hasIncoming.has(n));

  for (const root of roots) {
    const visited = new Set<string>();
    const queue: Array<[string, number]> = [[root, 0]];

    while (queue.length > 0) {
      const [node, depth] = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);

      const current = depths.get(node) ?? Infinity;
      depths.set(node, Math.min(current, depth));

      for (const neighbor of graph.adjacency.get(node) || []) {
        if (!visited.has(neighbor) && depth < 10) {
          queue.push([neighbor, depth + 1]);
        }
      }
    }
  }

  return depths;
}

// --- Markdown Section Parser ---

export interface SpecSection {
  heading: string;
  level: number; // 2 for ##, 3 for ###
  content: string;
  lineStart: number;
  lineEnd: number;
}

/** Parse markdown into sections at ## and ### boundaries */
export function parseSections(markdown: string): SpecSection[] {
  const lines = markdown.split('\n');
  const sections: SpecSection[] = [];

  let currentHeading = '(root)';
  let currentLevel = 1;
  let currentContent: string[] = [];
  let lineStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for ## or ### heading
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2 && !h3) {
      if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.join('\n').trim(),
          lineStart,
          lineEnd: i,
        });
      }
      currentHeading = h2[1];
      currentLevel = 2;
      currentContent = [];
      lineStart = i + 1;
    } else if (h3) {
      if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.join('\n').trim(),
          lineStart,
          lineEnd: i,
        });
      }
      currentHeading = h3[1];
      currentLevel = 3;
      currentContent = [];
      lineStart = i + 1;
    } else {
      currentContent.push(line);
    }
  }

  // Last section
  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      content: currentContent.join('\n').trim(),
      lineStart,
      lineEnd: lines.length,
    });
  }

  return sections;
}

/** Validate chunk sizes — warn if > 50K chars (AgentDocSpec limit) */
export function validateChunkSizes(
  sections: SpecSection[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const MAX_CHARS = 50_000;

  for (const section of sections) {
    if (section.content.length > MAX_CHARS) {
      warnings.push({
        file: '',
        rule: 'chunk-size',
        message: `Section "${section.heading}" is ${section.content.length.toLocaleString()} chars (limit: ${MAX_CHARS.toLocaleString()}). LLMs may truncate. Split into sub-sections.`,
        line: section.lineStart,
      });
    }
  }

  return warnings;
}

// --- Simulation ---

export interface SimulationResult {
  scenario: string;
  steps: SimulationStep[];
  outcome: 'success' | 'failure' | 'incomplete';
  elapsed: number; // ms
  errors: string[];
}

export interface SimulationStep {
  step: string;
  passed: boolean;
  preconditions: string[];
  postconditions: string[];
  errors: string[];
}
