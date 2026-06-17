import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const MINIMAL_SPEC = [
  '## Product',
  '',
  'A test project for CLI tests.',
  '',
  '## Data Model',
  '',
  '### Entity: Node',
  '',
  'A node in the spec graph.',
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

export function setupTempProject(baseDir: string, projectName: string): string {
  const projectDir = join(baseDir, 'projects', projectName);
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'SPEC.dog'), MINIMAL_SPEC);
  return projectDir;
}
