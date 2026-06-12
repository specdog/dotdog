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
