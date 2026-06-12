import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

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

    const requiredFiles = ['SPEC.md'];
    const optionalFiles = ['constitution.md', 'data-model.md', 'COPY.md', 'DESIGN-SYSTEM.md', 'plan.md', 'INDEX.md'];

    for (const file of requiredFiles) {
      if (files.includes(file)) {
        checks.push({ file, status: 'pass', message: 'exists' });
        const content = readFileSync(join(projectDir, file), 'utf-8');
        if (file === 'SPEC.md') {
          if (!content.includes('User Stories') && !content.includes('User Story')) {
            checks.push({ file, status: 'warn', message: 'no user stories found' });
          }
          if (!content.includes('## What the User Sees') && !content.includes('SCREEN')) {
            checks.push({ file, status: 'warn', message: 'no screen mockups (ASCII art)' });
          }
        }
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

    let pass = 0, warn = 0, fail = 0;
    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green('  ✓') : 
                   check.status === 'warn' ? chalk.yellow('  ⚠') : 
                   chalk.red('  ✗');
      console.log(`${icon} ${check.file} — ${check.message}`);
      if (check.status === 'pass') pass++;
      else if (check.status === 'warn') warn++;
      else fail++;
    }

    console.log('');
    const score = checks.length > 0 ? Math.round((pass / checks.length) * 100) : 0;
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
