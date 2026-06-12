import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export function list(): void {
  const dirs = ['projects', 'specs'];
  let found = false;

  for (const dir of dirs) {
    const root = join(process.cwd(), dir);
    if (!existsSync(root)) continue;

    const projects = readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    if (projects.length === 0) continue;
    found = true;

    console.log(chalk.bold(`\n${dir}/`));
    for (const project of projects) {
      const specDir = join(root, project, 'specs');
      const files = existsSync(specDir) ? readdirSync(specDir).filter(f => f.endsWith('.md')) : [];
      console.log(`  ${chalk.cyan(project)} — ${files.length} spec files`);
      for (const file of files) {
        console.log(chalk.gray(`    ${file}`));
      }
    }
  }

  if (!found) {
    console.log(chalk.yellow('No projects found.'));
    console.log(chalk.gray('Run: spec init <project>'));
  }
  console.log('');
}
