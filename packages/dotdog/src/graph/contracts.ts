const text = { type: 'string' };
const strings = { type: 'array', items: text };
const object = { type: 'object' };
const objects = { type: 'array', items: object };
const boolean = { type: 'boolean' };
const integer = { type: 'integer', minimum: 0 };
const shape = (properties: Record<string, any>, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const neighborhood = shape({ ok: boolean, nodes: objects, edges: objects });
const budget = shape({ maxTokens: { type: 'integer', minimum: 128, maximum: 131072 }, encoding: { const: 'o200k_base' }, tokenizer: { const: 'gpt-tokenizer@4.1.0' }, scope: { const: 'compact-json-text' }, excludes: text });

const outputs: Record<string, any> = {
  getEntity: shape({ name: text, type: text, properties: object, schema: object, states: strings, lifecycle: strings, edges: { type: 'array', items: { type: 'array' } } }),
  schema: shape({ entity: text, properties: object, schema: object }),
  summary: shape({ project: text, nodes: integer, edges: integer, savings: { type: 'number' }, savingsMethod: text, limitations: strings }),
  search: shape({ items: { type: 'array', items: { type: 'array', items: text } }, total: integer, nextCursor: { type: ['string', 'null'] } }),
  listProjects: shape({ items: strings, invalidProjects: object }),
  'workspace.list': shape({ workspace: object, mode: text, repos: objects, groups: { type: 'array' }, trustedAsInstruction: { const: false }, contentKind: { const: 'workspace-metadata' } }),
  traverse: shape({ ok: boolean, nodes: { type: 'array', items: shape({ name: text, edges: strings }) }, edges: objects, truncated: boolean }),
  path: neighborhood,
  impact: neighborhood,
  context: { anyOf: [shape({ ...neighborhood.properties, budget, omitted: shape({ nodes: integer, edges: integer }) }, neighborhood.required), shape({ ok: { const: false }, error: text, candidates: strings, budget }, ['ok', 'error', 'candidates'])] },
  infraVerify: { anyOf: [shape({ items: objects }), shape({ total: integer, results: objects })] },
};

export function toolOutputSchema(name: string) {
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', anyOf: [outputs[name], shape({ error: text })] };
}
