import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { parse } from '@spec/engine';
import type { EntityNode, RelationshipNode } from '@spec/engine';

export function analyze(dir: string, project?: string): void {
  console.log(chalk.bold('\nSpec Platform — Analyze\n'));

  const roots = [join(dir, 'projects'), join(dir, 'specs'), resolve(dir)];
  let specsDir = '';
  for (const root of roots) {
    if (existsSync(root) && root !== resolve(dir)) { specsDir = root; break; }
  }
  if (!specsDir) specsDir = resolve(dir);

  const projects: string[] = [];
  if (existsSync(specsDir)) {
    const entries = readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = join(specsDir, entry.name, 'specs');
        if (existsSync(subDir)) {
          if (!project || entry.name === project) projects.push(entry.name);
        }
      }
    }
    if (projects.length === 0) {
      const dogFiles = readdirSync(specsDir).filter(f => f.endsWith('.dog'));
      if (dogFiles.length > 0) projects.push(project || 'current');
    }
  }

  if (projects.length === 0) {
    console.log(chalk.yellow('  No spec projects found.'));
    console.log(chalk.gray('  Run: spec init <project>'));
    return;
  }

  for (const projectName of projects) {
    const files = new Map<string, string>();
    const possibleDirs = [join(specsDir, projectName, 'specs'), join(specsDir, projectName), specsDir];

    for (const dirPath of possibleDirs) {
      if (existsSync(dirPath)) {
        for (const file of readdirSync(dirPath).filter(f => f.endsWith('.dog'))) {
          if (!files.has(file)) files.set(file, readFileSync(join(dirPath, file), 'utf-8'));
        }
      }
    }

    if (files.size === 0) continue;

    console.log(chalk.bold(`\n  ${projectName}`));
    console.log('  ' + '─'.repeat(50));

    // Domain + stack from SPEC.dog
    const specContent = files.get('SPEC.dog') || '';
    const domain = specContent.match(/## Product\s*\n+(.+)/i)?.[1]?.trim()?.substring(0, 120) || 'unknown';
    const stackMatch = specContent.match(/## Stack\s*\n([\s\S]+?)(?=\n##|\n#|$)/i);
    let stack = 'unknown';
    if (stackMatch) {
      const rows = stackMatch[1].match(/\|.+\|/g);
      if (rows && rows.length > 1) {
        stack = rows.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean)[1] || '').filter(Boolean).join(', ');
      }
    }

    if (domain !== 'unknown') console.log(chalk.gray(`  ${domain}`));
    if (stack !== 'unknown') console.log(chalk.gray(`  Stack: ${stack}`));

    // Parse all files
    const allEntities: EntityNode[] = [];
    const allRelationships: RelationshipNode[] = [];
    const fileAnalyses: Array<{ file: string; sections: number; size: number; entities: number; relationships: number }> = [];

    for (const [filename, content] of files) {
      const ast = parse(content);
      const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity') as EntityNode[]);
      const relationships = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship') as RelationshipNode[]);
      allEntities.push(...entities);
      allRelationships.push(...relationships);

      fileAnalyses.push({
        file: filename,
        sections: ast.sections.length,
        size: content.length,
        entities: entities.length,
        relationships: relationships.length,
      });
    }

    // File summary
    const uniqueEntities = [...new Set(allEntities.map(e => e.name))];
    const uniqueRels = allRelationships.length;

    console.log('');
    const missingRequired = ['SPEC.dog', 'constitution.dog', 'data-model.dog'].filter(f => !files.has(f));
    const missingOptional = ['COPY.dog', 'plan.dog', 'DESIGN-SYSTEM.dog', 'INDEX.dog'].filter(f => !files.has(f));
    const totalGaps = missingRequired.length * 3 + missingOptional.length;

    let score = 100 - totalGaps * 5;
    // Deduct for undescribed entities
    const noDesc = allEntities.filter(e => !e.description || e.description.length < 5).length;
    score = Math.max(0, score - noDesc * 2);
    // Deduct for entities with no properties
    const noProps = allEntities.filter(e => Object.keys(e.properties).length === 0).length;
    score = Math.max(0, score - noProps * 3);
    // Deduct for entities with no states
    const noStates = allEntities.filter(e => e.states.length === 0).length;
    score = Math.max(0, score - noStates * 2);

    console.log(`  ${files.size} spec files | ${score}% complete`);
    for (const fa of fileAnalyses) {
      const detail = fa.entities > 0 ? ` (${fa.entities} entities, ${fa.relationships} rels)` : '';
      console.log(chalk.gray(`    ${fa.file} — ${fa.sections} sections, ${(fa.size / 1024).toFixed(1)}KB${detail}`));
    }

    // Gaps
    const gaps: Array<{ severity: string; file: string; finding: string; suggestion: string }> = [];

    for (const file of missingRequired) {
      gaps.push({ severity: 'critical', file, finding: 'Missing', suggestion: `Create ${file}` });
    }
    for (const file of missingOptional) {
      gaps.push({ severity: 'warning', file, finding: 'Missing', suggestion: `Create ${file}` });
    }

    // Entity gaps
    const entityNames = new Set(allEntities.map(e => e.name));
    for (const entity of allEntities) {
      if (!entity.description || entity.description.length < 5) {
        gaps.push({ severity: 'warning', file: 'data-model.dog', finding: `Entity "${entity.name}" has no description`, suggestion: 'Add a 1-3 sentence description for embedding and semantic search' });
      }
      if (Object.keys(entity.properties).length === 0) {
        gaps.push({ severity: 'warning', file: 'data-model.dog', finding: `Entity "${entity.name}" has no properties`, suggestion: 'Define at least 2 typed properties' });
      }
      if (entity.states.length === 0) {
        gaps.push({ severity: 'info', file: 'data-model.dog', finding: `Entity "${entity.name}" has no states`, suggestion: 'Define valid states and a lifecycle' });
      }
    }

    // Relationship gaps
    for (const rel of allRelationships) {
      if (rel.source && !entityNames.has(rel.source)) {
        gaps.push({ severity: 'warning', file: 'data-model.dog', finding: `Relationship references unknown source "${rel.source}"`, suggestion: 'Ensure all relationship sources are defined as entities' });
      }
      if (rel.target && !entityNames.has(rel.target)) {
        gaps.push({ severity: 'warning', file: 'data-model.dog', finding: `Relationship references unknown target "${rel.target}"`, suggestion: 'Ensure all relationship targets are defined as entities' });
      }
    }

    if (gaps.length > 0) {
      console.log(chalk.bold(`\n  Gaps (${gaps.length})`));
      const bySeverity: Record<string, string> = { critical: '🔴', warning: '🟡', info: '🔵' };
      for (const gap of gaps) {
        console.log(`  ${bySeverity[gap.severity] || '  '} ${gap.file}: ${gap.finding}`);
        console.log(chalk.gray(`     → ${gap.suggestion}`));
      }
    }

    if (gaps.length === 0) {
      console.log(chalk.green('\n  No gaps found. Spec is complete.'));
    } else {
      const criticals = gaps.filter(g => g.severity === 'critical').length;
      console.log(chalk.bold(`\n  ${criticals} critical gaps`));
    }
  }

  console.log('');
}
