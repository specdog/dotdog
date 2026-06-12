#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { DocumentNode, SectionNode, BlockNode, EntityNode, RelationshipNode, ProseNode, TableNode, PropertyDef } from './grammar';
import { parse } from './parser';

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
import { serve } from './serve';

const program = new Command();
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
program.name('spec').alias('dotdog').description('The spec dog — validate, analyze, generate, simulate .dog files').version(pkg.version);

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
  const name = p.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
  const tmpl: Record<string,string> = {
    'SPEC.dog': `# ${name}\n\n## Product\n\nWhat does it do? Who is it for?\n\n## What the User Sees\n\nSCREEN 1: Home — describe the main screen\n\n## User Stories\n\n| ID | Story | Pri |\n|----|-------|-----|\n| US-01 | | P0 |\n| US-02 | | P0 |\n| US-03 | | P1 |\n\n## Stack\n\n| Layer | Tech |\n|-------|------|\n| | |\n`,
    'data-model.dog': '# Data Model\n\n## Core Entities\n\nDefine your entities here. Each gets a name, properties, states, and lifecycle.\n\nExample:\n\n### Entity: User\n\nA person who uses the app.\n\n```yaml\nentity: User\ntype: entity\nproperties:\n  id:\n    type: string\n    required: true\n  name:\n    type: string\n    required: true\n  email:\n    type: string\n    required: true\nstates: [active, suspended]\nlifecycle: active → suspended\n```\n',
    'plan.dog': '# Plan\n\n## Phase 1: MVP\n\n- [ ] Fill in SPEC.dog with product description\n- [ ] Fill in data-model.dog with entities\n- [ ] Run `dotdog validate` to check completeness\n- [ ] Run `dotdog generate` to fill gaps\n\n## Phase 2: Build\n\n- [ ] Build core feature from user stories\n- [ ] Build remaining features\n',
    'constitution.dog': '# Constitution\n\nRules that don\'t change.\n\n1. **Data integrity over performance.**\n2. **User experience over complexity.**\n3. **Ship early. Iterate.**\n',
    'COPY.dog': '# Copy\n\n| Screen | Element | Text |\n|--------|---------|------|\n| | | |\n',
    'INDEX.dog': '# INDEX\n\n| You are | Start here | Then |\n|---------|-----------|------|\n| Developer | SPEC.dog | data-model.dog → plan.dog |\n| AI agent | data-model.dog | SPEC.dog → COPY.dog |\n| Designer | SPEC.dog | COPY.dog |\n',
  };
  for (const [f,c] of Object.entries(tmpl)) { writeFileSync(join(d,f),c); console.log(chalk.green(`  ✓ ${f}`)); }
  console.log(chalk.bold(`\n  ${name} initialized.`));
  console.log(chalk.gray('  Next: fill in SPEC.dog, then run `dotdog validate`'));
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

program.command('compile [dir]').option('-o, --output <file>').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const pd = join(dd,p,'specs');
      if (!existsSync(pd)) continue;
      const files = readdirSync(pd).filter(f=>f.endsWith('.dog'));
      const dag: any = { version: '1.1', project: p, compiled_at: new Date().toISOString(), nodes: [], edges: [], files: files.length };
      for (const f of files) {
        const content = readFileSync(join(pd,f),'utf-8');
        const ast = parse(content);
        for (const section of ast.sections) {
          for (const block of section.blocks) {
            if (block.kind === 'entity') {
              dag.nodes.push({
                id: block.name,
                type: block.type,
                description: block.description || '',
                file: f,
                properties: block.properties,
                states: block.states || [],
                lifecycle: block.lifecycle || [],
                chars: section.content?.length || 0
              });
            }
            if (block.kind === 'relationship') {
              dag.edges.push({
                source: block.source,
                target: block.target,
                verb: block.verb,
                cardinality: block.cardinality,
                required: block.required,
                cascade: block.cascade,
                file: f,
                section: section.heading
              });
            }
          }
        }
      }
      found = true;
      const out = opts.output || join(pd,'..',`${p}.dag`);
      writeFileSync(out, JSON.stringify(dag, null, 2));
      console.log(chalk.green(`  ✓ ${out}`));
      console.log(chalk.gray(`    ${dag.nodes.length} nodes, ${dag.edges.length} edges, ${dag.files} files`));
    }
  }
  if (!found) console.log(chalk.yellow('No projects found.'));
});

program.command('visualize [dir]').option('-s, --save').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const dagFile = join(dd,p,`${p}.dag`);
      if (!existsSync(dagFile)) continue;
      const dag = JSON.parse(readFileSync(dagFile,'utf-8'));
      let out = '```mermaid\ngraph LR\n';
      for (const n of dag.nodes||[]) out += `    ${n.id.replace(/\s+/g,'_')}[${n.id}]\n`;
      for (const e of dag.edges||[]) out += `    ${e.source.replace(/\s+/g,'_')} -->|${e.verb||''}| ${e.target.replace(/\s+/g,'_')}\n`;
      out += '```\n';
      if (opts.save) {
        const outFile = join(dd,p,'..',`${p}.md`);
        writeFileSync(outFile, `# ${p} — Spec Graph\n\n${out}`);
        console.log(chalk.green(`  ✓ ${outFile}`));
      }
      console.log(out);
    }
  }
});

program.command('serve [dir]').description('MCP server — expose .dag graph to AI agents over stdio').action((d='.') => serve(d));

program.command('analyze [dir]').description('Analyze a spec project — score, gaps, suggestions').option('-p, --project <name>').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold('\nSpec Analysis\n'));
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p,'specs');
      if (!existsSync(pd)) continue;
      const files = readdirSync(pd).filter(f=>f.endsWith('.dog'));
      if (!files.length) continue;
      found = true;
      console.log(chalk.bold(`\n  ${p}`));
      console.log('  ' + '─'.repeat(50));
      const allEntities: EntityNode[] = [];
      const allRelationships: RelationshipNode[] = [];
      const analyses: Array<{file:string, sections:number, size:number, entities:number, rels:number}> = [];
      for (const f of files) {
        const content = readFileSync(join(pd,f),'utf-8');
        const ast = parse(content);
        const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity') as EntityNode[]);
        const rels = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship') as RelationshipNode[]);
        allEntities.push(...entities);
        allRelationships.push(...rels);
        analyses.push({file:f, sections:ast.sections.length, size:content.length, entities:entities.length, rels:rels.length});
      }
      const missingReq = ['SPEC.dog','constitution.dog','data-model.dog'].filter(f => !files.includes(f));
      const missingOpt = ['COPY.dog','plan.dog','DESIGN-SYSTEM.dog','INDEX.dog'].filter(f => !files.includes(f));
      let score = 100 - missingReq.length * 15 - missingOpt.length * 5;
      const noDesc = allEntities.filter(e => !e.description || e.description.length < 10).length;
      score = Math.max(0, score - noDesc * 3);
      const noProps = allEntities.filter(e => Object.keys(e.properties).length === 0).length;
      score = Math.max(0, score - noProps * 5);
      const noStates = allEntities.filter(e => e.states.length === 0).length;
      score = Math.max(0, score - noStates * 3);
      console.log(`  ${files.length} files | ${score}% complete`);
      for (const a of analyses) {
        const detail = a.entities > 0 ? ` (${a.entities} entities, ${a.rels} rels)` : '';
        console.log(chalk.gray(`    ${a.file} — ${a.sections} sections, ${(a.size/1024).toFixed(1)}KB${detail}`));
      }
      const gaps: string[] = [];
      for (const f of missingReq) gaps.push(`🔴 ${f}: Missing required file`);
      for (const f of missingOpt) gaps.push(`🟡 ${f}: Missing optional file`);
      const entityNames = new Set(allEntities.map(e => e.name));
      for (const e of allEntities) {
        if (!e.description || e.description.length < 10) gaps.push(`🟡 ${e.name}: No description`);
        if (Object.keys(e.properties).length === 0) gaps.push(`🟡 ${e.name}: No properties defined`);
        if (e.states.length === 0) gaps.push(`🔵 ${e.name}: No states defined`);
      }
      for (const r of allRelationships) {
        if (r.source && !entityNames.has(r.source)) gaps.push(`🟡 Relationship: unknown source "${r.source}"`);
        if (r.target && !entityNames.has(r.target)) gaps.push(`🟡 Relationship: unknown target "${r.target}"`);
      }
      if (gaps.length > 0) { console.log(chalk.bold(`\n  Gaps (${gaps.length})`)); for (const g of gaps) console.log(`  ${g}`); }
      else console.log(chalk.green('\n  No gaps found.'));
    }
  }
  if (!found) console.log(chalk.yellow('No spec projects found. Run: dotdog init <project>'));
});

program.command('generate [dir]').description('Generate missing spec files from SPEC.dog').option('-p, --project <name>').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let specContent = '', specDir = '';
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p,'specs');
      const sp = join(pd,'SPEC.dog');
      if (existsSync(sp)) { specContent = readFileSync(sp,'utf-8'); specDir = pd; break; }
    }
    if (specContent) break;
  }
  if (!specContent) { console.log(chalk.red('No SPEC.dog found. Create one first.')); return; }
  console.log(chalk.bold('\nSpec Generator\n'));
  console.log(chalk.gray(`  Source: ${specDir}/SPEC.dog\n`));
  const ast = parse(specContent);
  // Extract entities from structured blocks
  const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity') as EntityNode[]);
  // Extract UI strings from prose in screen sections
  const uiStrings: Array<{screen:string, element:string, text:string}> = [];
  for (const section of ast.sections) {
    const h = section.heading.toLowerCase();
    if (h.includes('what the user sees') || h.includes('screen')) {
      const text = section.blocks.filter(b => b.kind === 'prose').map(b => (b as ProseNode).content).join('\n');
      for (const m of text.match(/\[([^\]]+)\]/g)||[]) uiStrings.push({screen:section.heading, element:'button', text:m});
      for (const m of text.match(/"([^"]+)"/g)||[]) uiStrings.push({screen:section.heading, element:'label', text:m});
    }
  }
  // Generate data-model.dog
  if (!existsSync(join(specDir,'data-model.dog')) && entities.length > 0) {
    let dm = '# Data Model\n\n## Core Entities\n\n';
    for (const e of entities) {
      dm += `### Entity: ${e.name}\n\n${e.description || 'No description.'}\n\n`;
      dm += '```yaml\n';
      dm += `entity: ${e.name}\n`;
      dm += `type: entity\n`;
      dm += 'properties:\n';
      for (const [k,v] of Object.entries(e.properties)) {
        dm += `  ${k}:\n`;
        dm += `    type: ${(v as PropertyDef).type}\n`;
        if ((v as PropertyDef).required) dm += `    required: true\n`;
      }
      if (e.states.length > 0) dm += `states: [${e.states.join(', ')}]\n`;
      dm += '```\n\n';
    }
    writeFileSync(join(specDir,'data-model.dog'), dm);
    console.log(chalk.green(`  ✓ data-model.dog (${entities.length} entities)`));
  }
  // Generate COPY.dog
  if (!existsSync(join(specDir,'COPY.dog')) && uiStrings.length > 0) {
    let copy = '# App Copy\n\n| Screen | Element | Copy |\n|--------|---------|------|\n';
    for (const s of uiStrings) copy += `| ${s.screen} | ${s.element} | ${s.text} |\n`;
    writeFileSync(join(specDir,'COPY.dog'), copy);
    console.log(chalk.green(`  ✓ COPY.dog (${uiStrings.length} strings)`));
  }
  // Generate INDEX.dog
  if (!existsSync(join(specDir,'INDEX.dog'))) {
    let idx = '# INDEX\n\n| You are... | Start here | Then... |\n|------------|-----------|---------|\n';
    idx += '| Developer | SPEC.dog | data-model.dog → plan.dog |\n';
    idx += '| AI agent | data-model.dog | COPY.dog → SPEC.dog |\n';
    idx += '| Designer | SPEC.dog | COPY.dog |\n';
    writeFileSync(join(specDir,'INDEX.dog'), idx);
    console.log(chalk.green('  ✓ INDEX.dog'));
  }
  console.log(chalk.bold('\nRun dotdog validate to verify.\n'));
});

program.command('simulate <scenario>').description('Run a simulation scenario (phase 1 stub)').option('-p, --project <name>', 'Project name', 'default').action((scenario, opts) => {
  console.log(chalk.bold(`\nSimulation: ${scenario} (project: ${opts.project})\n`));
  console.log(chalk.gray('Simulation engine — reads SPEC.dog scenarios, walks through steps, checks pre/postconditions.'));
  console.log(chalk.gray('Full engine coming in a future release.'));
});

program.command('staleness [dir]').action((d='.') => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold('Staleness Audit\n'));
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const pd = join(dd,p,'specs');
      if (!existsSync(pd)) continue;
      const planFile = join(pd,'plan.dog');
      if (!existsSync(planFile)) { console.log(chalk.yellow(`  ${p}: No plan.dog`)); continue; }
      const plan = readFileSync(planFile,'utf-8');
      const tasks = [...plan.matchAll(/^\s*- \[([ x])\]\s+(.+)/gm)];
      let issues = 0;
      for (const m of tasks) {
        const done = m[1] === 'x';
        const text = m[2].toLowerCase();
        // Only audit phases 1-3 — future phases are aspirational
        const precedingText = plan.substring(Math.max(0, m.index! - 200), m.index);
        const phaseMatch = precedingText.match(/Phase\s+(\d+)/);
        const phase = phaseMatch ? parseInt(phaseMatch[1]) : 99;
        if (phase > 3) continue;  // skip future phases
        // Check npm publish
        if (text.includes('npm publish') || text.includes('npm install')) {
          try {
            const pkg = JSON.parse(readFileSync(join(resolvePath('.'),'packages/dotdog/package.json'),'utf-8'));
            if (pkg.version && !done) { console.log(chalk.yellow(`  ⚠ Should be [x]: ${m[2].trim()}`)); issues++; }
          } catch {}
        }
        // Check compile
        if (text.includes('compile')) {
          if (!done) { console.log(chalk.yellow(`  ⚠ Should be [x]: ${m[2].trim()}`)); issues++; }
        }
        // Check generate
        if (text.includes('generate') && !done) {
          if (existsSync(join(dir,'packages/dotdog/src/cli.ts')) || existsSync(join(dir,'packages/spec-cli/src/generate.ts'))) {
            console.log(chalk.yellow(`  ⚠ Should be [x]: ${m[2].trim()}`)); issues++;
          }
        }
      }
      if (issues === 0) console.log(chalk.green(`  ${p}: spec matches reality`));
      else console.log(chalk.bold(`  ${issues} stale items. Update plan.dog.`));
    }
  }
});

program.parse();
