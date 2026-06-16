import { describe, test, expect } from 'bun:test';
import { parse, parseToJSON } from '../src/parser';
import { readFileSync } from 'fs';

describe('parser', () => {
  test('real data-model', () => {
    const content = readFileSync('projects/spec-platform/data-model.dog', 'utf-8');
    const ast = parse(content);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    const rels = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship'));
    expect(entities.length).toBe(8);
    expect(rels.length).toBe(5);
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

  test('parseToJSON', () => {
    const json = parseToJSON('### Entity: Test\n');
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe('document');
  });
});
