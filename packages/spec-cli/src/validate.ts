import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import {
  parseSections,
  validateChunkSizes,
  buildGraph,
  auditHopDepth,
  ONTOLOGY_ENTITY_TYPES,
} from '@spec/engine';

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
    const files = existsSync(projectDir) ? readdirSync(projectDir) : [];

    console.log(chalk.bold(`\n  ${project}`));
    console.log('  ' + '─'.repeat(40));

    // --- File existence checks ---
    const requiredFiles = ['SPEC.dog'];
    const optionalFiles = ['constitution.dog', 'data-model.dog', 'COPY.dog', 'DESIGN-SYSTEM.dog', 'plan.dog', 'INDEX.dog'];

    for (const file of requiredFiles) {
      if (files.includes(file)) {
        checks.push({ file, status: 'pass', message: 'exists' });
      } else {
        checks.push({ file, status: 'fail', message: 'missing — required' });
      }
    }

    for (const file of optionalFiles) {
      if (files.includes(file)) {
        checks.push({ file, status: 'pass', message: 'exists' });
      } else {
        checks.push({ file, status: 'warn', message: 'missing' });
      }
    }

    // --- Content checks (GraphRAG-informed) ---
    for (const file of files) {
      const content = readFileSync(join(projectDir, file), 'utf-8');

      // 1. Section chunking + size check (AgentDocSpec: max 50K chars per chunk)
      const sections = parseSections(content);
      const sizeWarnings = validateChunkSizes(sections);
      for (const w of sizeWarnings) {
        checks.push({
          file,
          status: 'warn',
          message: w.message,
        });
      }

      // 2. Section count — useful for LLM navigation
      if (sections.length > 0) {
        const h2s = sections.filter(s => s.level === 2);
        if (h2s.length > 0) {
          checks.push({
            file,
            status: 'pass',
            message: `${sections.length} sections (${h2s.length} top-level). Good for LLM chunking.`,
          });
        }
      }

      // 3. SPEC.md-specific checks
      if (file === 'SPEC.dog') {
        if (!content.includes('User Stories') && !content.includes('User Story')) {
          checks.push({ file, status: 'warn', message: 'no user stories found' });
        }
        if (!content.includes('## What the User Sees') && !content.includes('SCREEN')) {
          checks.push({ file, status: 'warn', message: 'no screen mockups (ASCII art)' });
        }
      }

      // 4. data-model.md: entity type enforcement (OMD-GraphRAG principle)
      if (file === 'data-model.dog') {
        // Count entity blocks — match both "entity: Name" and "### Entity: Name" formats
        const entityMatches = [
          ...content.matchAll(/(?:^|\n)(?:###\s+)?[Ee]ntity:\s*(\S[^\n]*)/g),
        ];
        if (entityMatches.length > 0) {
          const names = entityMatches.map(m => m[1].trim());
          const uniqueNames = [...new Set(names)];
          checks.push({
            file,
            status: 'pass',
            message: `${entityMatches.length} entity definitions (${uniqueNames.length} unique)`,
          });

          // Check descriptions — entities need them for embedding
          const entityBlocks = content.split(/(?:^|\n)(?:###\s+)?[Ee]ntity:/).slice(1);
          const withDesc = entityBlocks.filter(b =>
            b.includes('description:') || b.includes('Description:')
          );
          if (withDesc.length < entityBlocks.length) {
            checks.push({
              file,
              status: 'warn',
              message: `${entityBlocks.length - withDesc.length}/${entityBlocks.length} entities missing description — can't be embedded for semantic search`,
            });
          }
        }
      }

      // 5. constitution.md: principle count
      if (file === 'constitution.dog') {
        const principles = (content.match(/^\d+\.\s+\*\*/gm) || []).length;
        if (principles > 0) {
          checks.push({
            file,
            status: 'pass',
            message: `${principles} principles defined`,
          });
        }
      }
    }

    // --- Print results ---
    let pass = 0, warn = 0, fail = 0;
    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green('  ✓') :
        check.status === 'warn' ? chalk.yellow('  ⚠') :
        chalk.red('  ✗');
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
