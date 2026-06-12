// spec init — scaffold a new project with spec genome templates

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const TEMPLATES: Record<string, string> = {
  'INDEX.md': `# {PROJECT} — INDEX\n\n## Who reads what first\n\n| You are... | Start here | Then... |\n|------------|-----------|---------|\n| Team member | SPEC.md | constitution.md |\n| Developer | SPEC.md | plan.md → data-model.md |\n| AI agent | SPEC.md | tasks/AGENTS.md → data-model.md → COPY.md |\n`,
  'SPEC.md': `# {PROJECT} — SPEC\n\n## Product\n\n[One sentence. What does this produce?]\n\n## What the User Sees\n\n[ASCII art screens. Every state.]\n\n## User Stories\n\n| ID | Story | Pri | Acceptance |\n|----|-------|-----|------------|\n| US-01 | ... | P0 | ... |\n`,
  'constitution.md': `# {PROJECT} — Constitution\n\n## Core Principles\n\n1. **[Principle].** [Statement. Non-negotiable.]\n`,
  'data-model.md': `# {PROJECT} — Data Model\n\n## Entities\n\n[Exact structs. Copy-pastable into code.]\n\n## Events\n\n[What events fire?]\n`,
  'plan.md': `# {PROJECT} — Plan\n\n## Phases\n\n### Phase 1 — [time]\n\n- [ ] Task\n`,
  'COPY.md': `# {PROJECT} — Copy\n\n## [Screen Name]\n\n| Element | State | Copy |\n|---------|-------|------|\n| ... | idle | ... |\n`,
};

const TASKS_TEMPLATES: Record<string, string> = {
  'tasks.md': `# {PROJECT} — Tasks\n\n## T01 — [Task Name]\n\n- **Goal:** [what]\n- **Handoff:** [to whom]\n- **Files:** [paths]\n`,
  'tasks/AGENTS.md': `# {PROJECT} — Agent Pipeline\n\n## Roles\n\n| Agent | Domain | Model | Tools |\n|-------|--------|-------|-------|\n| ... | ... | ... | ... |\n\n## Handoff Loop\n\n[Agent A] → [Agent B] → [Agent C]\n`,
};

export async function init(project: string): Promise<void> {
  const baseDir = join(process.cwd(), 'specs', project);
  const specsDir = join(baseDir, 'specs');

  if (existsSync(specsDir)) {
    console.log(chalk.yellow(`Project "${project}" already exists.`));
    process.exit(1);
  }

  mkdirSync(specsDir, { recursive: true });
  mkdirSync(join(baseDir, 'tasks'), { recursive: true });

  // Write templates
  for (const [file, template] of Object.entries(TEMPLATES)) {
    writeFileSync(join(specsDir, file), template.replace(/\{PROJECT\}/g, project));
    console.log(chalk.green(`  ✓ ${file}`));
  }

  for (const [file, template] of Object.entries(TASKS_TEMPLATES)) {
    writeFileSync(join(baseDir, file), template.replace(/\{PROJECT\}/g, project));
    console.log(chalk.green(`  ✓ ${file}`));
  }

  console.log(chalk.bold(`\nProject "${project}" initialized.\n`));
  console.log(`  ${specsDir}/`);
  console.log(chalk.gray('  Next: fill in SPEC.md, then run `spec validate`'));
}
