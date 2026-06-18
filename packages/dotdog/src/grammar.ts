// .dog DSL Grammar — formal definition of the spec genome language
//
// A .dog file is a structured document with:
//   - Sections delimited by ## or ### headings
//   - Prose (markdown paragraphs, tables, lists)
//   - Structured blocks (entity, relationship, event, prediction definitions)
//
// Grammar (EBNF-like):
//
//   dog-file      ::= section*
//   section       ::= heading block*
//   heading       ::= "##" text | "###" text
//   block         ::= prose-block | entity-block | relationship-block | event-block | prediction-block
//   prose-block   ::= paragraph | table | code-fence | list
//   entity-block  ::= entity-heading (prose)? yaml-body
//   relationship-block ::= relationship-heading (prose)? yaml-body
//   event-block   ::= event-heading (prose)? yaml-body
//   entity-heading    ::= "###" "Entity:" entity-name
//   relationship-heading ::= "###" "Relationship:" source "→" target
//   event-heading     ::= "###" "Event:" event-name
//   yaml-body    ::= "```" yaml-content "```"
//   entity-name  ::= identifier
//   source       ::= identifier
//   target       ::= identifier
//   identifier   ::= [A-Za-z_][A-Za-z0-9_]*
//
// YAML schema within entity blocks:
//   entity:       name
//   type:         node | entity | relationship | event | task | prediction | vector
//   description:  string
//   properties:
//     prop-name: {type: string, required: boolean, constraints: string?, default: any?}
//   states:       [state, state, ...]
//   lifecycle:    state → state → state (→ state)*
//
// YAML schema within relationship blocks:
//   relationship: source → target
//   verb:         contains | depends_on | references | implements | calls | owns | precedes
//   cardinality:  1:1 | 1:N | N:1 | N:M
//   required:     boolean
//   cascade:      none | delete | nullify | restrict
//   invariants:   string

// --- AST Node Types ---

export type ASTNode =
  | DocumentNode
  | SectionNode
  | EntityNode
  | RelationshipNode
  | EventNode
  | PredictionNode
  | EndpointNode
  | ProseNode
  | TableNode;


// Parser error with line context
export interface ParseError {
  message: string;
  line?: number;
  context?: string; // the problematic line or section heading
}

export interface DocumentNode {
  kind: 'document';
  sections: SectionNode[];
  errors: ParseError[];
}

export interface SectionNode {
  kind: 'section';
  level: 2 | 3;
  heading: string;
  blocks: BlockNode[];
  lineStart: number;
  lineEnd: number;
}

export type BlockNode = EntityNode | RelationshipNode | EventNode | PredictionNode | EndpointNode | ProseNode | TableNode;

export interface EntityNode {
  kind: 'entity';
  name: string;
  description: string;
  type: string;
  properties: Record<string, PropertyDef>;
  states: string[];
  lifecycle: string[];
  yaml: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
}

export interface PropertyDef {
  type: string;
  required: boolean;
  default?: unknown;
  constraints?: string;
  example?: string;
}

export interface RelationshipNode {
  kind: 'relationship';
  source: string;
  target: string;
  verb: string;
  cardinality: string;
  required: boolean;
  cascade: string;
  invariants: string[];
  yaml: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
}

export interface EventNode {
  kind: 'event';
  name: string;
  trigger: string;
  payload: Record<string, string>;
  preconditions: string[];
  postconditions: string[];
  sideEffects: string[];
  probability: number | null;
  yaml: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
}

export interface PredictionNode {
  kind: 'prediction';
  statement: string;
  trigger: string;
  timeframe: string;
  confidence: number;
  measurement: string;
  yaml: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
}

export interface ProseNode {
  kind: 'prose';
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface TableNode {
  kind: 'table';
  headers: string[];
  rows: string[][];
  lineStart: number;
  lineEnd: number;
}

export interface EndpointNode {
  kind: 'endpoint';
  name: string;
  url: string;
  backup_url?: string;
  method: string;
  expect_status: number;
  expect_body: Record<string, unknown> | null;
  timeout: number;
  yaml: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
}
