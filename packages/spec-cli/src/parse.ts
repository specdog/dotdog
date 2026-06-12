// spec parse — read .dog file and output AST

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parseToJSON } from '@spec/engine';
import chalk from 'chalk';

export function parseCommand(file: string, options: { json?: boolean; summary?: boolean }): void {
  const paths = [resolve(file), join(process.cwd(), file), join(process.cwd(), 'projects', file), join(process.cwd(), 'specs', file)];
  let content = '';

  for (const p of paths) {
    if (existsSync(p)) {
      content = readFileSync(p, 'utf-8');
      break;
    }
  }

  if (!content) {
    console.error(chalk.red(`  File not found: ${file}`));
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(parseToJSON(content));
    return;
  }

  // Summary (default)
  const ast = JSON.parse(parseToJSON(content));
  console.log(chalk.bold('Parse Summary\n'));
  console.log(`  Sections: ${ast.sections.length}`);
  for (const section of ast.sections) {
    const entities = section.blocks.filter((b: any) => b.kind === 'entity');
    const relationships = section.blocks.filter((b: any) => b.kind === 'relationship');
    const events = section.blocks.filter((b: any) => b.kind === 'event');
    const prose = section.blocks.filter((b: any) => b.kind === 'prose');
    const tables = section.blocks.filter((b: any) => b.kind === 'table');
    
    const parts: string[] = [];
    if (entities.length) parts.push(`${entities.length} entities`);
    if (relationships.length) parts.push(`${relationships.length} relationships`);
    if (events.length) parts.push(`${events.length} events`);
    if (tables.length) parts.push(`${tables.length} tables`);
    if (prose.length) parts.push(`${prose.length} prose`);
    
    console.log(`  ${section.heading.padEnd(30)} ${parts.join(', ') || 'empty'}`);
  }
}
