// spec analyze — read any spec directory, report what it IS and what's missing

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { analyzeProject } from '@spec/engine';

export function analyze(dir: string, project?: string): void {
  console.log(chalk.bold('\nSpec Platform — Analyze\n'));

  // Find the specs directory
  const roots = [join(dir, 'projects'), join(dir, 'specs'), resolve(dir)];
  let specsDir = '';
  for (const root of roots) {
    if (existsSync(root) && root !== resolve(dir)) { specsDir = root; break; }
  }
  // If no projects/ or specs/ found, treat dir itself as a spec directory
  if (!specsDir) specsDir = resolve(dir);

  // Find projects
  const projects: string[] = [];
  if (existsSync(specsDir)) {
    const entries = readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if it has a specs/ subdirectory
        const subDir = join(specsDir, entry.name, 'specs');
        if (existsSync(subDir)) {
          if (!project || entry.name === project) {
            projects.push(entry.name);
          }
        }
      }
    }
    // If no projects found, check if dir itself has .md files
    if (projects.length === 0) {
      const mdFiles = readdirSync(specsDir).filter(f => f.endsWith('.dog'));
      if (mdFiles.length > 0) {
        projects.push(project || 'current');
      }
    }
  }

  if (projects.length === 0) {
    console.log(chalk.yellow('  No spec projects found.'));
    console.log(chalk.gray('  Run: spec init <project>'));
    return;
  }

  for (const projectName of projects) {
    // Read all spec files
    const files = new Map<string, string>();
    const possibleDirs = [
      join(specsDir, projectName, 'specs'),
      join(specsDir, projectName),
      specsDir,
    ];

    for (const dirPath of possibleDirs) {
      if (existsSync(dirPath)) {
        const mdFiles = readdirSync(dirPath).filter(f => f.endsWith('.dog'));
        for (const file of mdFiles) {
          if (!files.has(file)) {
            files.set(file, readFileSync(join(dirPath, file), 'utf-8'));
          }
        }
      }
    }

    if (files.size === 0) continue;

    const analysis = analyzeProject(projectName, files);

    // --- Output ---
    console.log(chalk.bold(`\n  ${analysis.project}`));
    console.log('  ' + '─'.repeat(50));

    // Domain + stack
    if (analysis.domain !== 'unknown') {
      console.log(chalk.gray(`  ${analysis.domain}`));
    }
    if (analysis.stack !== 'unknown') {
      console.log(chalk.gray(`  Stack: ${analysis.stack}`));
    }

    // Files
    console.log('');
    console.log(`  ${analysis.fileCount} spec files | ${analysis.completeness}% complete`);
    for (const f of analysis.files) {
      const issues = f.issues.length > 0 ? chalk.yellow(` (${f.issues.length} issues)`) : '';
      console.log(chalk.gray(`    ${f.file} — ${f.sections} sections, ${(f.size / 1024).toFixed(1)}KB${issues}`));
    }

    // Gaps
    if (analysis.gaps.length > 0) {
      console.log(chalk.bold(`\n  Gaps (${analysis.gaps.length})`));
      const bySeverity = { critical: '🔴', warning: '🟡', info: '🔵' } as const;
      for (const gap of analysis.gaps) {
        const icon = bySeverity[gap.severity] || '  ';
        const label = gap.file ? `${gap.file}: ` : '';
        console.log(`  ${icon} ${label}${gap.finding}`);
        console.log(chalk.gray(`     → ${gap.suggestion}`));
      }
    }

    // Suggestions
    if (analysis.suggestions.length > 0) {
      console.log(chalk.bold(`\n  Suggestions (${analysis.suggestions.length})`));
      const byPriority = { P0: 'critical', P1: 'high', P2: 'nice' } as const;
      let lastPriority = '';
      for (const s of analysis.suggestions) {
        if (s.priority !== lastPriority) {
          lastPriority = s.priority;
          console.log(chalk.gray(`\n    [${s.priority}] ${byPriority[s.priority]}`));
        }
        console.log(`    ${chalk.cyan(s.action.padEnd(14))} ${s.file.padEnd(20)} ${s.description}`);
      }
    }

    // Summary
    if (analysis.gaps.length === 0 && analysis.suggestions.length === 0) {
      console.log(chalk.green('\n  No gaps found. Spec is complete.'));
    } else {
      const criticals = analysis.gaps.filter(g => g.severity === 'critical').length;
      const p0s = analysis.suggestions.filter(s => s.priority === 'P0').length;
      console.log(chalk.bold(`\n  ${criticals} critical gaps, ${p0s} P0 actions`));
    }
  }

  console.log('');
}
