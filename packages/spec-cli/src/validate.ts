import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { parse, parseSections } from '@spec/engine';
import type { DocumentNode, EntityNode, RelationshipNode } from '@spec/engine';

interface Check {
  file: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export function validate(dir: string): void {
  console.log(chalk.bold('\nSpec Platform — Validator\n'));

  const checks: Check[] = [];
  const roots = [join(dir, 'projects'), join(dir, 'specs')];
  let specsDir = '';

  for (const root of roots) {
    if (existsSync(root)) { specsDir = root; break; }
  }

  if (!specsDir) {
    console.log(chalk.red('  No projects/ or specs/ directory found.'));
    console.log(chalk.gray('  Run: spec init <project>'));
    process.exit(1);
  }

  const projects = readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (projects.length === 0) {
    console.log(chalk.yellow('  No projects found.'));
    return;
  }

  for (const project of projects) {
    const projectDir = join(specsDir, project, 'specs');
    const files = existsSync(projectDir) ? readdirSync(projectDir).filter(f => f.endsWith('.dog')) : [];

    console.log(chalk.bold(`\n  ${project}`));
    console.log('  ' + '─'.repeat(40));

    // File existence
    const requiredFiles = ['SPEC.dog'];
    const optionalFiles = ['constitution.dog', 'data-model.dog', 'COPY.dog', 'DESIGN-SYSTEM.dog', 'plan.dog', 'INDEX.dog'];

    for (const file of requiredFiles) {
      checks.push({ file, status: files.includes(file) ? 'pass' : 'fail', message: files.includes(file) ? 'exists' : 'missing — required' });
    }
    for (const file of optionalFiles) {
      checks.push({ file, status: files.includes(file) ? 'pass' : 'warn', message: files.includes(file) ? 'exists' : 'missing' });
    }

    // Parse each file
    for (const file of files) {
      const content = readFileSync(join(projectDir, file), 'utf-8');
      const ast = parse(content);

      // Section count
      const sections = parseSections(content);
      const h2s = sections.filter(s => s.level === 2);
      checks.push({ file, status: 'pass', message: `${sections.length} sections (${h2s.length} top-level). Good for LLM chunking.` });

      // Extract all entities and relationships from AST
      const entities: EntityNode[] = [];
      const relationships: RelationshipNode[] = [];
      for (const section of ast.sections) {
        for (const block of section.blocks) {
          if (block.kind === 'entity') entities.push(block as EntityNode);
          if (block.kind === 'relationship') relationships.push(block as RelationshipNode);
        }
      }

      // Entity checks
      if (entities.length > 0) {
        const unique = [...new Set(entities.map(e => e.name))];
        checks.push({ file, status: 'pass', message: `${entities.length} entity definitions (${unique.length} unique)` });

        // Descriptions
        const withDesc = entities.filter(e => e.description && e.description.length > 5);
        const noDesc = entities.length - withDesc.length;
        if (noDesc > 0) {
          checks.push({ file, status: 'warn', message: `${noDesc}/${entities.length} entities missing description — can't be embedded for semantic search` });
        }

        // Properties
        for (const entity of entities) {
          const propCount = Object.keys(entity.properties).length;
          if (propCount === 0) {
            checks.push({ file, status: 'warn', message: `Entity "${entity.name}" has no properties defined` });
          }
          // Check for states
          if (entity.states.length === 0) {
            checks.push({ file, status: 'warn', message: `Entity "${entity.name}" has no states defined` });
          }
        }
      }

      // Relationship checks
      if (relationships.length > 0) {
        checks.push({ file, status: 'pass', message: `${relationships.length} relationship definitions` });

        // Verify all relationship sources/targets reference real entities
        const entityNames = new Set(entities.map(e => e.name));
        for (const rel of relationships) {
          if (rel.source && !entityNames.has(rel.source)) {
            checks.push({ file, status: 'warn', message: `Relationship "${rel.source} → ${rel.target}" references unknown source "${rel.source}"` });
          }
          if (rel.target && !entityNames.has(rel.target)) {
            checks.push({ file, status: 'warn', message: `Relationship "${rel.source} → ${rel.target}" references unknown target "${rel.target}"` });
          }
        }
      }

      // SPEC.dog specific
      if (file === 'SPEC.dog') {
        if (!content.includes('User Stor') && !content.includes('user stor')) {
          checks.push({ file, status: 'warn', message: 'no user stories found' });
        }
        if (!content.includes('SCREEN') && !content.includes('What the User Sees')) {
          checks.push({ file, status: 'warn', message: 'no screen mockups (ASCII art)' });
        }
      }

      // constitution.dog specific
      if (file === 'constitution.dog') {
        const principles = (content.match(/^\d+\.\s+\*\*/gm) || []).length;
        if (principles > 0) {
          checks.push({ file, status: 'pass', message: `${principles} principles defined` });
        }
      }
    }

    // Print
    let pass = 0, warn = 0, fail = 0;
    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green('  ✓') :
        check.status === 'warn' ? chalk.yellow('  ⚠') : chalk.red('  ✗');
      console.log(`${icon} ${check.file.padEnd(22)} ${check.message}`);
      if (check.status === 'pass') pass++;
      else if (check.status === 'warn') warn++;
      else fail++;
    }

    console.log('');
    const total = checks.length || 1;
    const score = Math.round((pass / total) * 100);
    console.log(`  Score: ${score}% | ${chalk.green(`${pass} pass`)} | ${chalk.yellow(`${warn} warn`)} | ${chalk.red(`${fail} fail`)}`);
  }

  const totalFail = checks.filter(c => c.status === 'fail').length;
  if (totalFail > 0) {
    console.log(chalk.red(`\n${totalFail} error(s). Fix before shipping.\n`));
    process.exit(1);
  } else {
    console.log(chalk.green('\nAll required files present.\n'));
  }
}
