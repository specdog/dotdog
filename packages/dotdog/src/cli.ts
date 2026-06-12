#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

function resolvePath(p: string): string {
  if (p.startsWith('~')) p = join(homedir(), p.slice(1));
  return p.startsWith('/') ? p : join(process.cwd(), p);
}

// --- Inline engine functions (no deps) ---
export { parse, parseToJSON } from './parser';
export type { DocumentNode, SectionNode, EntityNode, RelationshipNode, BlockNode } from './grammar';

function parseSections(markdown: string): Array<{heading:string,level:number,content:string,lineStart:number,lineEnd:number}> {
  const lines = markdown.split('\n'), sections: any[] = [];
  let heading = '(root)', level = 1, content: string[] = [], lineStart = 1;
  for (let i = 0; i < lines.length; i++) {
    const m2 = lines[i].match(/^##\s+(.+)/), m3 = lines[i].match(/^###\s+(.+)/);
    if (m2 && !m3) {
      if (content.length > 0 || sections.length === 0) sections.push({heading,level,content:content.join('\n').trim(),lineStart,lineEnd:i});
      heading = m2[1]; level = 2; content = []; lineStart = i + 1;
    } else if (m3) {
      if (content.length > 0 || sections.length === 0) sections.push({heading,level,content:content.join('\n').trim(),lineStart,lineEnd:i});
      heading = m3[1]; level = 3; content = []; lineStart = i + 1;
    } else { content.push(lines[i]); }
  }
  if (content.length > 0 || sections.length === 0) sections.push({heading,level,content:content.join('\n').trim(),lineStart,lineEnd:lines.length});
  return sections;
}

// --- CLI Commands ---
const program = new Command();
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
program.name('spec').alias('dotdog').description('The spec dog — validate, analyze, generate .dog files').version(pkg.version);

program.command('validate [dir]').action((d='.') => {
  const dirs = [join(d,'projects'),join(d,'specs')];
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      found = true;
      const pd = join(dd,p,'specs');
      const files = existsSync(pd) ? readdirSync(pd).filter(f=>f.endsWith('.dog')) : [];
      const missing = ['SPEC.dog','constitution.dog','data-model.dog'].filter(f=>!files.includes(f));
      const optional = ['COPY.dog','plan.dog','DESIGN-SYSTEM.dog','INDEX.dog'].filter(f=>!files.includes(f));
      console.log(chalk.bold(`\n  ${p} — ${files.length} .dog files, ${100-Math.round((missing.length*3+optional.length)/20*100)}% complete`));
      for (const f of files) console.log(chalk.gray(`    ${f}`));
      if (missing.length) console.log(chalk.red(`  Missing required: ${missing.join(', ')}`));
      if (optional.length) console.log(chalk.yellow(`  Missing optional: ${optional.join(', ')}`));
    }
  }
  if (!found) console.log(chalk.yellow('No projects found. Run: spec init <project>'));
});

program.command('init <project>').action((p) => {
  const d = join(process.cwd(),'specs',p);
  mkdirSync(d,{recursive:true});
  const tmpl: Record<string,string> = {
    'SPEC.dog': '# Project\n\n## Product\n\n',
    'constitution.dog': '# Constitution\n\n1. **Rule.**\n',
    'data-model.dog': '# Data Model\n\n## Entities\n\n',
    'plan.dog': '# Plan\n\n## Phase 1\n\n- [ ] Task\n',
    'COPY.dog': '# Copy\n\n| Element | Copy |\n|---|---|\n',
    'INDEX.dog': '# INDEX\n\n| You | Start | Then |\n|---|---|---|\n',
  };
  for (const [f,c] of Object.entries(tmpl)) { writeFileSync(join(d,f),c); console.log(chalk.green(`  ✓ ${f}`)); }
  console.log(chalk.bold(`\nProject "${p}" initialized. Fill in SPEC.dog then run spec validate.`));
});

program.command('list').action(() => {
  for (const d of ['projects','specs']) {
    const dd = join(process.cwd(),d);
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    if (!projects.length) continue;
    console.log(chalk.bold(`\n${d}/`));
    for (const p of projects) {
      const sp = join(dd,p,'specs');
      const n = existsSync(sp) ? readdirSync(sp).filter(f=>f.endsWith('.dog')).length : 0;
      console.log(`  ${chalk.cyan(p)} — ${n} .dog files`);
    }
  }
});

program.command('parse <file>').action((f) => {
  const c = readFileSync(f,'utf-8');
  const s = parseSections(c);
  console.log(chalk.bold(`\n${s.length} sections`));
  for (const sec of s) console.log(`  ${sec.heading.padEnd(30)} ${sec.content.length} chars`);
});

program.parse();
