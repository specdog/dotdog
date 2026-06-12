// spec generate — read SPEC.dog and generate missing spec files

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from '@spec/engine';
import type { SectionNode, TableNode, ProseNode, BlockNode } from '@spec/engine';
import chalk from 'chalk';

export function generate(dir: string, project?: string): void {
  const roots = [join(dir, 'projects'), join(dir, 'specs'), resolve(dir)];
  let specsDir = '';
  for (const root of roots) {
    if (existsSync(root)) { specsDir = root; break; }
  }

  // Find SPEC.dog
  let specContent = '';
  let specPath = '';
  for (const root of [specsDir, ...roots]) {
    const paths = [
      join(root, 'SPEC.dog'),
      join(root, 'specs', 'SPEC.dog'),
    ];
    for (const p of paths) {
      if (existsSync(p)) { specContent = readFileSync(p, 'utf-8'); specPath = p; break; }
    }
    if (specContent) break;
  }

  if (!specContent) {
    console.log(chalk.red('No SPEC.dog found. Create one first.'));
    process.exit(1);
  }

  const ast = parse(specContent);

  // --- Extract entities from User Stories ---
  const entities = extractEntities(ast);
  
  // --- Extract UI strings from screens ---
  const uiStrings = extractUIStrings(ast);

  // --- Extract principles from product section ---
  const principles = extractPrinciples(ast);

  // --- Extract stack ---
  const stack = extractStack(ast);

  // --- Determine output directory ---
  const outDir = specPath.replace(/\/?SPEC\.dog$/, '');
  
  console.log(chalk.bold('\nSpec Generator\n'));
  console.log(chalk.gray(`  Source: ${specPath}`));
  console.log(chalk.gray(`  Output: ${outDir}\n`));

  // --- Generate data-model.dog ---
  if (!existsSync(join(outDir, 'data-model.dog')) && entities.length > 0) {
    let dm = `# Data Model\n\n## Core Entities\n\n`;
    for (const entity of entities) {
      dm += `### Entity: ${entity.name}\n\n${entity.description}\n\n`;
      dm += '```yaml\n';
      dm += `entity: ${entity.name}\n`;
      dm += `type: entity\n`;
      dm += 'properties:\n';
      for (const prop of entity.properties) {
        dm += `  ${prop.name}:\n`;
        dm += `    type: ${prop.type}\n`;
        if (prop.required) dm += `    required: true\n`;
      }
      if (entity.states.length > 0) {
        dm += `states: [${entity.states.join(', ')}]\n`;
      }
      dm += '```\n\n';
    }
    writeFileSync(join(outDir, 'data-model.dog'), dm);
    console.log(chalk.green(`  ✓ data-model.dog (${entities.length} entities)`));
  } else if (entities.length === 0) {
    console.log(chalk.yellow('  ⚠ No entities found in SPEC.dog'));
  }

  // --- Generate COPY.dog ---
  if (!existsSync(join(outDir, 'COPY.dog')) && uiStrings.length > 0) {
    let copy = `# App Copy\n\n`;
    copy += '| Screen | Element | Copy |\n';
    copy += '|--------|---------|------|\n';
    for (const str of uiStrings) {
      copy += `| ${str.screen} | ${str.element} | ${str.text} |\n`;
    }
    writeFileSync(join(outDir, 'COPY.dog'), copy);
    console.log(chalk.green(`  ✓ COPY.dog (${uiStrings.length} strings)`));
  }

  // --- Generate constitution.dog ---
  if (!existsSync(join(outDir, 'constitution.dog')) && principles.length > 0) {
    let con = `# Constitution\n\n## Core Principles\n\n`;
    principles.forEach((p, i) => {
      con += `${i + 1}. **${p}**\n`;
    });
    if (stack.length > 0) {
      con += '\n## Tech Constraints\n\n';
      con += '| Area | Constraint |\n';
      con += '|------|-----------|\n';
      for (const s of stack) {
        con += `| ${s.layer} | ${s.tech} |\n`;
      }
    }
    writeFileSync(join(outDir, 'constitution.dog'), con);
    console.log(chalk.green(`  ✓ constitution.dog (${principles.length} principles)`));
  }

  // --- Generate INDEX.dog ---
  if (!existsSync(join(outDir, 'INDEX.dog'))) {
    let idx = `# INDEX\n\n`;
    idx += '| You are... | Start here | Then... |\n';
    idx += '|------------|-----------|---------|\n';
    idx += '| Developer | SPEC.dog | data-model.dog → plan.dog |\n';
    idx += '| AI agent | data-model.dog | COPY.dog → SPEC.dog |\n';
    idx += '| Designer | SPEC.dog | COPY.dog |\n';
    writeFileSync(join(outDir, 'INDEX.dog'), idx);
    console.log(chalk.green('  ✓ INDEX.dog'));
  }

  console.log(chalk.bold('\nRun spec validate to verify.\n'));
}

// --- Extractors ---

interface ExtractedEntity {
  name: string;
  description: string;
  properties: Array<{ name: string; type: string; required: boolean }>;
  states: string[];
}

function extractEntities(ast: { sections: SectionNode[] }): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Look for nouns in user story tables
  for (const section of ast.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'table') {
        const table = block as TableNode;
        const headerIdx = table.headers.findIndex(h => 
          h.toLowerCase().includes('story') || h.toLowerCase().includes('feature')
        );
        if (headerIdx >= 0) {
          for (const row of table.rows) {
            const story = row[headerIdx] || '';
            // Extract nouns: "Create a split with amount and contacts" → Split
            const nouns = extractNouns(story);
            for (const noun of nouns) {
              if (!seen.has(noun)) {
                seen.add(noun);
                entities.push({
                  name: noun,
                  description: `Extracted from user story: ${story}`,
                  properties: inferProperties(noun, story),
                  states: inferStates(noun),
                });
              }
            }
          }
        }
      }
    }
  }

  // Also look for entities mentioned in prose
  for (const section of ast.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'prose') {
        const text = (block as ProseNode).content;
        if (text.includes('Entity:') || text.includes('entity')) {
          // Already has entities defined
        }
      }
    }
  }

  return entities;
}

function extractNouns(story: string): string[] {
  const nouns: string[] = [];
  const capitalized = story.match(/\b[A-Z][a-z]+\b/g) || [];
  const HUMAN_ROLES = ['Friends', 'Friend', 'User', 'Admin', 'Owner', 'Manager', 'Customer', 'Client', 'Member', 'Person', 'People', 'Sender', 'Receiver', 'Recipient'];
  const VERB_STARTS = ['Create', 'Send', 'See', 'Add', 'Delete', 'Update', 'Remove', 'Get', 'View', 'Edit', 'Make', 'Build'];
  
  for (const word of capitalized) {
    if (!VERB_STARTS.includes(word) && !HUMAN_ROLES.includes(word)) {
      nouns.push(word);
    }
  }
  return [...new Set(nouns)];
}

function inferProperties(entityName: string, story: string): Array<{ name: string; type: string; required: boolean }> {
  const props: Array<{ name: string; type: string; required: boolean }> = [
    { name: 'id', type: 'string', required: true },
    { name: 'created_at', type: 'string', required: true },
  ];
  const lower = story.toLowerCase();
  const name = entityName.toLowerCase();

  // Split entity
  if (name === 'split') {
    if (lower.includes('amount') || lower.includes('$')) props.push({ name: 'amount', type: 'number', required: true });
    if (lower.includes('contact') || lower.includes('friend')) props.push({ name: 'contact_ids', type: 'string[]', required: true });
    props.push({ name: 'status', type: 'enum', required: true });
    props.push({ name: 'split_type', type: 'enum', required: true });
    return props;
  }

  // Payment entity
  if (name === 'payment') {
    props.push({ name: 'amount', type: 'number', required: true });
    props.push({ name: 'status', type: 'enum', required: true });
    props.push({ name: 'payer_id', type: 'string', required: true });
    props.push({ name: 'split_id', type: 'string', required: true });
    if (lower.includes('stripe')) props.push({ name: 'stripe_payment_id', type: 'string', required: false });
    return props;
  }

  // Contact entity
  if (name === 'contact') {
    props.push({ name: 'name', type: 'string', required: true });
    if (lower.includes('email')) props.push({ name: 'email', type: 'string', required: false });
    if (lower.includes('phone')) props.push({ name: 'phone', type: 'string', required: false });
    return props;
  }

  // Generic fallback
  if (lower.includes('amount') || lower.includes('$')) props.push({ name: 'amount', type: 'number', required: true });
  if (lower.includes('contact') || lower.includes('friend')) props.push({ name: 'contact_id', type: 'string', required: true });
  if (lower.includes('pay') || lower.includes('paid')) props.push({ name: 'status', type: 'enum', required: true });
  if (lower.includes('email')) props.push({ name: 'email', type: 'string', required: false });

  return props;
}

function inferStates(entityName: string): string[] {
  const name = entityName.toLowerCase();
  if (name === 'payment') return ['pending', 'processing', 'completed', 'failed'];
  if (name === 'split') return ['draft', 'sent', 'partially_paid', 'settled'];
  if (name === 'contact') return ['active', 'blocked'];
  if (name === 'user') return ['active', 'suspended', 'deleted'];
  return ['active', 'archived'];
}

interface UIString {
  screen: string;
  element: string;
  text: string;
}

function extractUIStrings(ast: { sections: SectionNode[] }): UIString[] {
  const strings: UIString[] = [];

  for (const section of ast.sections) {
    if (section.heading.toLowerCase().includes('what the user sees') || 
        section.heading.toLowerCase().includes('screen')) {
      const text = section.blocks
        .filter(b => b.kind === 'prose')
        .map(b => (b as ProseNode).content)
        .join('\n');

      // Extract bracketed text like [New Split], [Send Request]
      const brackets = text.match(/\[([^\]]+)\]/g);
      if (brackets) {
        for (const b of brackets) {
          strings.push({
            screen: section.heading,
            element: 'button',
            text: b,
          });
        }
      }

      // Extract quoted text
      const quoted = text.match(/"([^"]+)"/g);
      if (quoted) {
        for (const q of quoted) {
          strings.push({
            screen: section.heading,
            element: 'label',
            text: q.replace(/"/g, ''),
          });
        }
      }

      // Extract dollar amounts
      const amounts = text.match(/\$\d+/g);
      if (amounts) {
        for (const a of amounts) {
          strings.push({
            screen: section.heading,
            element: 'label',
            text: a,
          });
        }
      }
    }
  }

  return strings;
}

function extractPrinciples(ast: { sections: SectionNode[] }): string[] {
  const principles: string[] = [];

  for (const section of ast.sections) {
    if (section.heading.toLowerCase().includes('product')) {
      const text = section.blocks
        .filter(b => b.kind === 'prose')
        .map(b => (b as ProseNode).content)
        .join(' ');

      // Extract Stack entries as constraints
      if (text.includes('Stripe')) {
        principles.push('All payments processed through Stripe. No alternative payment providers.');
      }
      if (text.includes('SQLite')) {
        principles.push('Local-first data storage. Offline-capable.');
      }
      if (text.includes('React Native')) {
        principles.push('iOS and Android parity. One codebase.');
      }
    }
  }

  // Default principles
  if (principles.length === 0) {
    principles.push('Data integrity over performance.');
    principles.push('User privacy first. No data sharing.');
  }

  return principles;
}

function extractStack(ast: { sections: SectionNode[] }): Array<{ layer: string; tech: string }> {
  const stack: Array<{ layer: string; tech: string }> = [];

  for (const section of ast.sections) {
    if (section.heading.toLowerCase().includes('stack')) {
      for (const block of section.blocks) {
        if (block.kind === 'table') {
          const table = block as TableNode;
          for (const row of table.rows) {
            if (row.length >= 2) {
              stack.push({ layer: row[0], tech: row[1] });
            }
          }
        }
      }
    }
  }

  return stack;
}
