// .dog Parser — text → AST
// Parses .dog files into the typed AST defined in grammar.ts

import type {
  ASTNode, DocumentNode, SectionNode, BlockNode,
  EntityNode, RelationshipNode, EventNode, PredictionNode,
  PropertyDef, ProseNode, TableNode,
} from './grammar';

// --- Main entry ---

export function parse(source: string): DocumentNode {
  const lines = source.split('\n');
  const sections = parseSections(lines);
  return { kind: 'document', sections };
}

export function parseToJSON(source: string): string {
  const ast = parse(source);
  return JSON.stringify(ast, null, 2);
}

// --- Section parser ---

function parseSections(lines: string[]): SectionNode[] {
  const sections: SectionNode[] = [];
  let i = 0;

  // Root section (content before first heading — skip lines under ## to avoid double-counting in named sections)
  let firstHeading = lines.length;
  for (let j = 0; j < lines.length; j++) {
    if (/^##\s/.test(lines[j])) { firstHeading = j; break; }
  }
  const rootBlocks = parseBlocks(lines, 0, firstHeading);
  if (rootBlocks.length > 0) {
    sections.push({
      kind: 'section',
      level: 1,
      heading: '(root)',
      blocks: rootBlocks,
      lineStart: 1,
      lineEnd: lines.length,
    });
  }

  // Named sections
  while (i < lines.length) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2 || h3) {
      const level = h2 ? 2 : 3;
      const heading = (h2 || h3)![1];
      const sectionStart = i;
      i++;

      // Find end of section (next heading of same or higher level)
      const end = findSectionEnd(lines, i, level);
      const blocks = parseBlocks(lines, sectionStart, end);
      
      sections.push({
        kind: 'section',
        level: level as 2 | 3,
        heading,
        blocks,
        lineStart: sectionStart + 1,
        lineEnd: end + 1,
      });
      i = end;
    } else {
      i++;
    }
  }

  return sections;
}

function findSectionEnd(lines: string[], start: number, currentLevel: number): number {
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line) || /^###\s/.test(line)) return i;  // Any heading ends current section
  }
  return lines.length;
}

// --- Block parser ---

function parseBlocks(lines: string[], start: number, end: number): BlockNode[] {
  const blocks: BlockNode[] = [];
  let i = start;

  while (i < end) {
    const line = lines[i];

    // Entity block?
    const entityMatch = line.match(/^###\s+Entity:\s*(.+)/);
    if (entityMatch) {
      const result = parseStructuredBlock(lines, i, end, 'entity', entityMatch[1]);
      if (result) { blocks.push(result.node); i = result.nextLine; continue; }
    }

    // Relationship block?
    const relMatch = line.match(/^###\s+Relationship:\s*(.+)/);
    if (relMatch) {
      const result = parseStructuredBlock(lines, i, end, 'relationship', relMatch[1]);
      if (result) { blocks.push(result.node); i = result.nextLine; continue; }
    }

    // Event block?
    const eventMatch = line.match(/^###\s+Event:\s*(.+)/);
    if (eventMatch) {
      const result = parseStructuredBlock(lines, i, end, 'event', eventMatch[1]);
      if (result) { blocks.push(result.node); i = result.nextLine; continue; }
    }

    // Prediction block?
    const predMatch = line.match(/^###\s+Prediction:\s*(.+)/);
    if (predMatch) {
      const result = parseStructuredBlock(lines, i, end, 'prediction', predMatch[1]);
      if (result) { blocks.push(result.node); i = result.nextLine; continue; }
    }

    // Table?
    if (/^\|.+\|/.test(line) && i + 1 < end && /^\|[-| ]+\|/.test(lines[i + 1])) {
      const table = parseTable(lines, i, end);
      if (table) { blocks.push(table); i = table.lineEnd; continue; }
    }

    // Collect prose
    const proseStart = i;
    while (i < end && !isBlockStart(lines[i])) {
      i++;
    }
    const proseLines = lines.slice(proseStart, i).filter(l => l.trim() !== '' || i === proseStart + 1);
    if (proseLines.length > 0) {
      blocks.push({
        kind: 'prose',
        content: proseLines.join('\n').trim(),
        lineStart: proseStart + 1,
        lineEnd: i,
      });
    }
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return /^###\s+(Entity|Relationship|Event|Prediction):/.test(line) || /^\|.+\|/.test(line);
}

// --- Structured block parser ---

function parseStructuredBlock(
  lines: string[], start: number, end: number,
  kind: string, headerRest: string
): { node: BlockNode; nextLine: number } | null {
  let i = start + 1;
  let description = '';

  // Collect prose description before the YAML block
  while (i < end && !lines[i].startsWith('```') && !isBlockStart(lines[i])) {
    if (lines[i].trim()) description += (description ? ' ' : '') + lines[i].trim();
    i++;
  }

  // Find the YAML code fence
  if (i >= end || !lines[i].startsWith('```')) {
    // No YAML block — treat as prose-only entity
    return {
      node: {
        kind: kind as 'entity',
        name: headerRest,
        description,
        type: 'node',
        properties: {},
        states: [],
        lifecycle: [],
        yaml: {},
        lineStart: start + 1,
        lineEnd: i,
      },
      nextLine: i,
    };
  }

  // Collect YAML content
  i++; // skip opening ```
  const yamlLines: string[] = [];
  while (i < end && !lines[i].startsWith('```')) {
    yamlLines.push(lines[i]);
    i++;
  }
  i++; // skip closing ```

  const yaml = parseSimpleYAML(yamlLines);

  // Build the appropriate node
  if (kind === 'entity') {
    return {
      node: buildEntityNode(headerRest, description, yaml, start, i),
      nextLine: i,
    };
  }

  if (kind === 'relationship') {
    return {
      node: buildRelationshipNode(headerRest, description, yaml, start, i),
      nextLine: i,
    };
  }

  if (kind === 'event') {
    return {
      node: buildEventNode(headerRest, description, yaml, start, i),
      nextLine: i,
    };
  }

  if (kind === 'prediction') {
    return {
      node: buildPredictionNode(headerRest, description, yaml, start, i),
      nextLine: i,
    };
  }

  return null;
}

// --- Entity builder ---

function buildEntityNode(name: string, description: string, yaml: Record<string, unknown>, lineStart: number, lineEnd: number): EntityNode {
  const properties: Record<string, PropertyDef> = {};
  const rawProps = yaml.properties as Record<string, Record<string, unknown>> | undefined;
  if (rawProps) {
    for (const [key, val] of Object.entries(rawProps)) {
      if (typeof val === 'object' && val !== null) {
        properties[key] = {
          type: (val.type as string) || 'string',
          required: val.required !== false,
          default: val.default,
          constraints: val.constraints as string | undefined,
          example: val.example as string | undefined,
        };
      }
    }
  }

  const states = Array.isArray(yaml.states) ? yaml.states as string[] : [];
  const lifecycleStr = (yaml.lifecycle as string) || '';
  const lifecycleParts = lifecycleStr ? lifecycleStr.split(/\s*→\s*/).map(s => s.trim()) : [];
  const lifecycle: string[] = [];
  for (let si = 0; si < lifecycleParts.length - 1; si++) {
    lifecycle.push(`${lifecycleParts[si]} → ${lifecycleParts[si + 1]}`);
  }

  return {
    kind: 'entity',
    name,
    description: description || (yaml.description as string) || '',
    type: (yaml.type as string) || 'node',
    properties,
    states,
    lifecycle,
    yaml,
    lineStart: lineStart + 1,
    lineEnd,
  };
}

// --- Relationship builder ---

function buildRelationshipNode(headerRest: string, description: string, yaml: Record<string, unknown>, lineStart: number, lineEnd: number): RelationshipNode {
  // Parse "Source -> Target" from heading
  const parts = headerRest.split(/\s*→\s*/);
  const source = parts[0]?.trim() || (yaml.source as string) || '';
  const target = parts[1]?.trim() || (yaml.target as string) || '';

  return {
    kind: 'relationship',
    source,
    target,
    verb: (yaml.verb as string) || 'connects',
    description: description || (yaml.description as string) || '',
    cardinality: (yaml.cardinality as string) || 'N:M',
    required: yaml.required === true,
    cascade: (yaml.cascade as string) || 'none',
    invariants: Array.isArray(yaml.invariants) ? yaml.invariants as string[] : [(yaml.invariants as string) || ''],
    yaml,
    lineStart: lineStart + 1,
    lineEnd,
  };
}

// --- Event builder ---

function buildEventNode(name: string, description: string, yaml: Record<string, unknown>, lineStart: number, lineEnd: number): EventNode {
  return {
    kind: 'event',
    name,
    trigger: (yaml.trigger as string) || '',
    payload: (yaml.payload as Record<string, string>) || {},
    preconditions: Array.isArray(yaml.preconditions) ? yaml.preconditions as string[] : [],
    postconditions: Array.isArray(yaml.postconditions) ? yaml.postconditions as string[] : [],
    sideEffects: Array.isArray(yaml.sideEffects) ? yaml.sideEffects as string[] : [],
    probability: typeof yaml.probability === 'number' ? yaml.probability : null,
    yaml,
    lineStart: lineStart + 1,
    lineEnd,
  };
}

// --- Prediction builder ---

function buildPredictionNode(name: string, description: string, yaml: Record<string, unknown>, lineStart: number, lineEnd: number): PredictionNode {
  return {
    kind: 'prediction',
    statement: name,
    description,
    trigger: (yaml.trigger as string) || '',
    timeframe: (yaml.timeframe as string) || '',
    confidence: (yaml.confidence as number) || 0,
    measurement: (yaml.measurement as string) || '',
    status: (yaml.status as string) || 'pending',
    yaml,
    lineStart,
    lineEnd,
  };
}

// --- Table parser ---

function parseTable(lines: string[], start: number, end: number): TableNode | null {
  const headerLine = lines[start];
  const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);

  let i = start + 2; // skip header + separator
  const rows: string[][] = [];

  while (i < end && lines[i].startsWith('|')) {
    const row = lines[i].split('|').map(c => c.trim()).filter(Boolean);
    rows.push(row);
    i++;
  }

  if (headers.length === 0) return null;

  return {
    kind: 'table',
    headers,
    rows,
    lineStart: start + 1,
    lineEnd: i,
  };
}

// --- Simple YAML parser (handles our subset) ---

function parseSimpleYAML(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentObj: Record<string, unknown> = {};
  let inNested = false;
  let nestedKey = '';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    // Top-level key: value
    const topMatch = line.match(/^(\w[\w_]*):\s*(.+)?$/);
    if (topMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
      // Flush nested object
      if (inNested && currentKey) {
        result[currentKey] = currentObj;
        inNested = false;
        currentObj = {};
      }
      currentKey = topMatch[1];
      const value = (topMatch[2] || '').trim();

      if (value === '') {
        inNested = true;
        currentObj = {};
      } else if (value === 'true') {
        result[currentKey] = true;
      } else if (value === 'false') {
        result[currentKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        result[currentKey] = parseFloat(value);
      } else if (value.startsWith('[') && value.endsWith(']')) {
        result[currentKey] = value.slice(1, -1).split(',').map(s => s.trim());
      } else if (value.startsWith('null')) {
        result[currentKey] = null;
      } else {
        result[currentKey] = value;
      }
      continue;
    }

    // Nested property:   key: value (inside a mapping like properties:)
    const nestedMatch = line.match(/^\s{2}(\w[\w_]*):\s*(.+)?$/);
    if (nestedMatch && inNested) {
      nestedKey = nestedMatch[1];
      const value = (nestedMatch[2] || '').trim();

      if (value === '' || value === '{') {
        currentObj[nestedKey] = {};
      } else if (value === 'true') {
        currentObj[nestedKey] = true;
      } else if (value === 'false') {
        currentObj[nestedKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        currentObj[nestedKey] = parseFloat(value);
      } else if (value.startsWith('[') && value.endsWith(']')) {
        currentObj[nestedKey] = value.slice(1, -1).split(',').map(s => s.trim());
      } else {
        currentObj[nestedKey] = value;
      }
      continue;
    }
    // Indented key after a scalar top-level value: treat as new top-level key
    // Allows:  relationship: User -> Order
    //            verb: places       ← treated as top-level
    if (nestedMatch && !inNested) {
      const key = nestedMatch[1];
      const value = (nestedMatch[2] || '').trim();
      if (value === 'true') result[key] = true;
      else if (value === 'false') result[key] = false;
      else if (/^-?\d+(\.\d+)?$/.test(value)) result[key] = parseFloat(value);
      else if (value.startsWith('[') && value.endsWith(']')) result[key] = value.slice(1, -1).split(',').map(s => s.trim());
      else result[key] = value;
      continue;
    }

    // Triple-nested:     key: value (inside a nested object like properties)
    const deepMatch = line.match(/^\s{4}(\w[\w_]*):\s*(.+)?$/);
    if (deepMatch && inNested && nestedKey && typeof currentObj[nestedKey] === 'object') {
      const deepNested = currentObj[nestedKey] as Record<string, unknown>;
      const key = deepMatch[1];
      const value = (deepMatch[2] || '').trim();
      const inlineObj = parseInlineObject(value);
      deepNested[key] = inlineObj || value;
    }
  }

  // Flush last nested object
  if (inNested && currentKey) {
    result[currentKey] = currentObj;
  }

  return result;
}

function parseInlineObject(value: string): Record<string, unknown> | null {
  // Parse {type: string, required: true, min: 0}
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return null;

  const obj: Record<string, unknown> = {};
  const pairs = match[1].split(',').map(s => s.trim());
  for (const pair of pairs) {
    const [k, ...vParts] = pair.split(':');
    if (!k || vParts.length === 0) continue;
    let v = vParts.join(':').trim();
    if (v === 'true') obj[k.trim()] = true;
    else if (v === 'false') obj[k.trim()] = false;
    else if (/^-?\d+(\.\d+)?$/.test(v)) obj[k.trim()] = parseFloat(v);
    else obj[k.trim()] = v;
  }
  return obj;
}
