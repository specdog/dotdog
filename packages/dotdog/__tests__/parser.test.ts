import { describe, test, expect } from 'bun:test';
import { parse, parseToJSON } from '../src/parser';

describe('parser', () => {
  test('entity and relationship parsing from real-format doc', () => {
    const content = [
      '## Data Model',
      '',
      '### Entity: Node',
      '',
      'A spec node.',
      '',
      '```',
      'entity: Node',
      'type: entity',
      'properties:',
      '  id:',
      '    type: string',
      '    format: uuid-v4',
      '    required: true',
      'states: [draft, complete]',
      'lifecycle: draft → complete',
      '```',
      '',
      '### Entity: Task',
      '',
      'A work item.',
      '',
      '```',
      'entity: Task',
      'type: entity',
      'properties:',
      '  title:',
      '    type: string',
      '    required: true',
      'states: [specified, building, verified]',
      'lifecycle: specified → building → verified',
      '```',
      '',
      '### Relationship: Node → Task',
      '',
      '```',
      'relationship: Node → Task',
      'verb: contains',
      'cardinality: 1:n',
      'required: false',
      '```',
    ].join('\n');
    const ast = parse(content);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    const rels = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship'));
    expect(entities.length).toBe(2);
    expect(rels.length).toBe(1);
  });

  test('entity parsing', () => {
    const doc = [
      '## Data Model',
      '',
      '### Entity: User',
      '',
      'A user.',
      '',
      '```',
      'entity: User',
      'type: entity',
      'properties:',
      '  email:',
      '    type: string',
      '    required: true',
      'states: [active, suspended]',
      'lifecycle: active → suspended',
      '```',
    ].join('\n');
    const ast = parse(doc);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    expect(entities.length).toBe(1);
    const e = entities[0] as any;
    expect(e.name).toBe('User');
    expect(e.properties.email.type).toBe('string');
    expect(e.properties.email.required).toBe(true);
    expect(e.states).toEqual(['active', 'suspended']);
  });

  test('empty document', () => {
    const ast = parse('');
    expect(ast.kind).toBe('document');
  });

  test('plain fenced blocks parse as prose', () => {
    const ast = parse([
      '## Product',
      '',
      '```bash',
      'dotdog validate',
      '```',
      '',
      'After validation, compile the graph.',
    ].join('\n'));
    const prose = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'prose'));
    expect(prose.length).toBeGreaterThan(0);
    expect(prose.some(block => (block as any).content.includes('dotdog validate'))).toBe(true);
  });

  test('parseToJSON', () => {
    const json = parseToJSON('### Entity: Test\n');
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe('document');
  });
});
