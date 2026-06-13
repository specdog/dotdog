#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import type { DocumentNode, SectionNode, BlockNode, EntityNode, RelationshipNode, ProseNode, TableNode, PropertyDef } from './grammar';
import { parse } from './parser';

function resolvePath(p: string): string {
  if (p.startsWith('~')) p = join(homedir(), p.slice(1));
  const resolved = p.startsWith('/') ? p : join(process.cwd(), p);
  // Prevent traversal outside working directory for relative paths.
  // Allow descendants (cdw/child), same dir (cwd), and ancestors (parent of cwd).
  if (!p.startsWith('/') && !p.startsWith('~')) {
    const rel = resolve(process.cwd(), p);
    const cwd = process.cwd();
    const isDescendant = rel.startsWith(cwd + '/');
    const isSelf = rel === cwd;
    const isAncestor = cwd.startsWith(rel + '/');
    if (!isDescendant && !isSelf && !isAncestor) {
      throw new Error(`Path traversal blocked: ${p}`);
    }
    return rel;
  }
  return resolved;
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
program.name('spec').alias('dotdog').description('CLI for structured software specs : validate .dog, compile .dag, query via MCP').version(pkg.version);

program.command('validate [dir]').action((d='.') => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs')];
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      found = true;
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const files = existsSync(pd) ? readdirSync(pd).filter(f=>f.endsWith('.dog')) : [];
      const missing = ['SPEC.dog','constitution.dog','data-model.dog'].filter(f=>!files.includes(f));
      const optional = ['COPY.dog','plan.dog','DESIGN-SYSTEM.dog','INDEX.dog'].filter(f=>!files.includes(f));
      console.log(chalk.bold(`\n  ${p} : ${files.length} .dog files, ${100-Math.round((missing.length*3+optional.length)/20*100)}% complete`));
      for (const f of files) console.log(chalk.gray(`    ${f}`));
      if (missing.length) console.log(chalk.red(`  Missing required: ${missing.join(', ')}`));
      if (optional.length) console.log(chalk.yellow(`  Missing optional: ${optional.join(', ')}`));
    }
  }
  if (!found) console.log(chalk.yellow('No projects found. Run: spec init <project>'));
});

program.command('init <project>').option('-m, --minimal', 'Only SPEC.dog + data-model.dog').action((p, opts) => {
  const d = join(process.cwd(),'specs',p);
  mkdirSync(d,{recursive:true});
  const full: Record<string,string> = {
    'SPEC.dog': '# Project\n\n## Product\n\n',
    'constitution.dog': '# Constitution\n\n1. **Rule.**\n',
    'data-model.dog': '# Data Model\n\n## Entities\n\n',
    'plan.dog': '# Plan\n\n## Phase 1\n\n- [ ] Task\n',
    'COPY.dog': '# Copy\n\n| Element | Copy |\n|---|---|\n',
    'INDEX.dog': '# INDEX\n\n| You | Start | Then |\n|---|---|---|\n',
  };
  const minimal: Record<string,string> = {
    'SPEC.dog': '# Project\n\n## Product\n\n',
    'data-model.dog': '# Data Model\n\n## Entities\n\n',
  };
  const tmpl = opts.minimal ? minimal : full;
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
      const sp = join(dd,p);
      const n = existsSync(sp) ? readdirSync(sp).filter(f=>f.endsWith('.dog')).length : 0;
      console.log(`  ${chalk.cyan(p)} : ${n} .dog files`);
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
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      if (!existsSync(pd)) continue;
      const files = readdirSync(pd).filter(f=>f.endsWith('.dog')).sort();
      if (!files.length) continue;
      found = true;
      // Read source files, count bytes (exclude template stubs for accurate savings)
      const sources: Record<string,string> = {};
      let sourceBytes = 0, contentBytes = 0;
      for (const f of files) {
        const content = readFileSync(join(pd,f),'utf-8');
        sources[f] = content;
        const bytes = Buffer.byteLength(content,'utf-8');
        sourceBytes += bytes;
        // Exclude template stubs (< 100 bytes) from content-only calc
        if (bytes >= 100) contentBytes += bytes;
      }
      const sourceTokens = Math.round(sourceBytes / 4);
      const contentTokens = Math.round(contentBytes / 4);
      // Compile nodes + edges with compact keys
      const nodes: any[] = [], edges: any[] = [];
      for (const f of files) {
        const ast = parse(sources[f]);
        for (const section of ast.sections) {
          for (const block of section.blocks) {
            if (block.kind === 'entity' || block.kind === 'event') {
              // Compact property schema: s=string, n=number, b=boolean, e=enum, j=json, !=required
              const compactProps: Record<string, string> = {};
              for (const [key, val] of Object.entries(block.properties || {})) {
                let enc = '';
                const t = val.type || 'string';
                if (t === 'string') enc = 's';
                else if (t === 'number') enc = 'n';
                else if (t === 'boolean') enc = 'b';
                else if (t === 'enum') enc = 'e';
                else if (t === 'json') enc = 'j';
                else enc = t[0]; // fallback: first char
                if (val.required) enc += '!';
                compactProps[key] = enc;
              }
              nodes.push({
                i: (block as any).name || '',
                t: (block as any).type || '',
                g: block.kind,
                d: (block as any).description || '',
                p: compactProps,
                s: (block as any).states || [],
                l: (block as any).lifecycle || [],
              });
            }
            if (block.kind === 'prediction') {
              nodes.push({
                i: (block as any).statement || (block as any).name || '',
                t: 'prediction',
                g: 'prediction',
                d: (block as any).description || '',
                p: {},
                s: [],
                l: [],
                cf: (block as any).confidence || 0,
                tf: (block as any).timeframe || '',
                tg: (block as any).trigger || '',
                ms: (block as any).measurement || '',
              });
            }
            if (block.kind === 'relationship') {
              edges.push({
                s: block.source,
                t: block.target,
                v: block.verb,
                d: block.description || '',
                c: block.cardinality,
                r: block.required,
              });
            }
          }
        }
      }
      // Build compact .dag
      const dag = { v: '1.4', p, c: `dotdog@${pkg.version}`, n: nodes, e: edges };
      // Calculate token savings
      const dagJson = JSON.stringify(dag);
      const dagTokens = Math.round(Buffer.byteLength(dagJson,'utf-8') / 4);
      const allSavingsPct = sourceTokens > 0 ? Math.round((1 - dagTokens / sourceTokens) * 1000) / 10 : 0;
      const contentSavingsPct = contentTokens > 0 ? Math.round((1 - dagTokens / contentTokens) * 1000) / 10 : 0;
      const savingsTokens = sourceTokens - dagTokens;
      const outPath = opts.output || join(pd,`${p}.dag`);
      const tokens = { m: 'chars/4', st: sourceTokens, ct: contentTokens, dt: dagTokens, sv: allSavingsPct, cs: contentSavingsPct, saved: savingsTokens };
      const report = { ...dag, tk: tokens };
      writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`  ✓ ${outPath}`));
      console.log(chalk.gray(`    ${nodes.length} nodes, ${edges.length} edges, ${files.length} files`));
      console.log(chalk.gray(`    ${sourceTokens} → ${dagTokens} tokens (${allSavingsPct}% savings, ${contentSavingsPct}% content-only, ${savingsTokens} saved)`));
    }
  }
  if (!found) console.log(chalk.yellow('No projects found.'));
});

program.command('tokens [dir]').action((d='.') => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const dagFile = join(pd,`${p}.dag`);
      if (!existsSync(dagFile)) continue;
      found = true;
      // Count source bytes
      const dogFiles = readdirSync(pd).filter(f=>f.endsWith('.dog'));
      let sourceBytes = 0, contentBytes = 0;
      for (const f of dogFiles) {
        const bytes = Buffer.byteLength(readFileSync(join(pd,f),'utf-8'),'utf-8');
        sourceBytes += bytes;
        if (bytes >= 100) contentBytes += bytes;
      }
      const dagBytes = Buffer.byteLength(readFileSync(dagFile,'utf-8'),'utf-8');
      const savings = sourceBytes > 0 ? Math.round((1 - dagBytes / sourceBytes) * 1000) / 10 : 0;
      console.log(chalk.bold(`\n  ${p}`));
      console.log(chalk.gray(`    ${dogFiles.length} .dog files: ${sourceBytes} bytes`));
      console.log(chalk.gray(`    .dag file: ${dagBytes} bytes`));
      console.log(chalk.green(`    ${savings}% smaller (${sourceBytes - dagBytes} bytes saved)`));
      if (contentBytes && contentBytes !== sourceBytes) {
        const cs = Math.round((1 - dagBytes / contentBytes) * 1000) / 10;
        console.log(chalk.gray(`    content-only: ${contentBytes} bytes → ${cs}% savings`));
      }
    }
  }
  if (!found) console.log(chalk.yellow('No .dag files found. Run compile first.'));
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
        writeFileSync(outFile, `# ${p} : Spec Graph\n\n${out}`);
        console.log(chalk.green(`  ✓ ${outFile}`));
      }
      console.log(out);
    }
  }
});

program.command('serve [dir]').description('MCP server : expose .dag graph to AI agents over stdio').action((d='.') => serve(resolvePath(d)));

program.command('analyze [dir]').description('Analyze a spec project : score, gaps, suggestions').option('-p, --project <name>').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold('\nSpec Analysis\n'));
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
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
        console.log(chalk.gray(`    ${a.file} : ${a.sections} sections, ${(a.size/1024).toFixed(1)}KB${detail}`));
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
      const pd = join(dd,p);
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
  console.log(chalk.gray('Simulation engine : reads SPEC.dog scenarios, walks through steps, checks pre/postconditions.'));
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
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      if (!existsSync(pd)) continue;
      const planFile = join(pd,'plan.dog');
      if (!existsSync(planFile)) { console.log(chalk.yellow(`  ${p}: No plan.dog`)); continue; }
      const plan = readFileSync(planFile,'utf-8');
      const tasks = [...plan.matchAll(/^\s*- \[([ x])\]\s+(.+)/gm)];
      let issues = 0;
      for (const m of tasks) {
        const done = m[1] === 'x';
        const text = m[2].toLowerCase();
        // Only audit phases 1-3 : future phases are aspirational
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

program.command('woof').action(() => {
  console.log('  / \\__');
  console.log(' (    @\\___');
  console.log('  /       O');
  console.log(' /   (_____/');
  console.log('/_____/   U');
});

program.parse();
