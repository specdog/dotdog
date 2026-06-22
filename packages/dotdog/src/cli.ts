#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { buildIndex, searchIndex } from './index';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import type { DocumentNode, SectionNode, BlockNode, EntityNode, RelationshipNode, ProseNode, TableNode, PropertyDef } from './grammar';
import { parse } from './parser';
import { safeProjectName, writeRepoMap } from './map/repoMapper';
import { formatQueryResult, formatTrace, loadWorldModel, queryWorldModel, traceWorldNode } from './dag/query';
import { compileDotdogLayers } from './dag/layers';


function normalizeDag(dag: any): any {
  if (Array.isArray(dag)) {
    // v3 format: [version, project, nodes, tokens]
    // Convert back to v2 format for backward compat
    const v3Nodes = (dag[2] || []).map((n: any[], i: number) => {
      // v3 node: [name, type_code, [props], states|null, edges|null, forecast?]
      // Convert to v2: [id, name, type, desc, props, states, edges]
      const props = n[2] || [];
      const states = n[3] || [];
      const edges = n[4] || [];
      return [i, n[0], n[1] === 'p' ? 'prediction' : 'entity', '', props, states, edges];
    });
    return { v: dag[0], p: dag[1], n: v3Nodes, tk: dag[3] };
  }
  return dag;
}

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

function githubRemote(repoDir = process.cwd()): string | null {
  try {
    const remote = execSync('git remote get-url origin', { cwd: repoDir, encoding: 'utf8' }).trim();
    const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch { return null; }
}

function ghIssues(repo: string): Array<{ number:number; title:string; state:string; body:string }> {
  const raw = execSync(`gh issue list --repo ${repo} --state all --limit 100 --json number,title,state,body`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw || '[]');
}

function projectEntities(projectDir: string): string[] {
  const files = readdirSync(projectDir).filter(f => f.endsWith('.dog'));
  const entities = new Set<string>();
  for (const f of files) {
    try {
      const ast = parse(readFileSync(join(projectDir, f), 'utf-8'));
      for (const s of ast.sections) for (const b of s.blocks) if (b.kind === 'entity') entities.add((b as EntityNode).name.toLowerCase());
    } catch {}
  }
  return [...entities];
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
  let found = false, hasErrors = false;
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
      console.log(chalk.bold(`\n  ${p} : ${files.length} .dog files, ${Math.max(0, 100-Math.round(missing.length*3/20*100))}% complete`));
      for (const f of files) console.log(chalk.gray(`    ${f}`));
      if (missing.length) { console.log(chalk.red(`  Missing required: ${missing.join(', ')}`)); hasErrors = true; }
      if (optional.length) console.log(chalk.gray(`  Optional: ${optional.join(', ')} — not required for 100%`));
    }
  }
  if (!found) console.log(chalk.yellow('No projects found. Run: spec init <project>'));
  if (hasErrors) process.exit(1);
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
  for (const [f,c] of Object.entries(tmpl)) {
    writeFileSync(join(d,f),c);
    try { parse(c); } catch (_) { console.log(chalk.red(`  ✗ Template ${f} is invalid`)); process.exit(1); }
    console.log(chalk.green(`  ✓ ${f}`));
  }
  console.log(chalk.bold(`\nProject "${p}" initialized. Fill in SPEC.dog then run spec validate.`));
});

program.command('issues [repo]').description('Check GitHub issue coverage against spec entities').option('--json', 'Output JSON').action((repoArg = '', opts) => {
  const repo = repoArg || githubRemote();
  if (!repo) { console.log(chalk.red('No GitHub remote found.')); process.exit(1); }
  const root = join(process.cwd(), 'specs');
  const projects = existsSync(root) ? readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name) : [];
  const results: any[] = [];
  for (const p of projects) {
    const pd = join(root, p);
    if (!existsSync(join(pd,'SPEC.dog'))) continue;
    const entities = projectEntities(pd);
    const issues = ghIssues(repo);
    const uncovered = issues.filter(i => !entities.some(e => (i.title + ' ' + (i.body || '')).toLowerCase().includes(e)));
    results.push({ project: p, entities: entities.length, issues: issues.length, uncovered: uncovered.length });
    console.log(chalk.bold(`\n  ${p}`));
    console.log(`  ${entities.length} entities, ${issues.length} issues, ${uncovered.length} uncovered`);
  }
  if (opts.json) console.log(JSON.stringify(results, null, 2));
});

program.command('list').option('--json', 'Output project names as JSON').action((opts: { json?: boolean }) => {
  const entries: Array<{ root: string; name: string; dogFiles: number }> = [];
  for (const d of ['projects','specs']) {
    const dd = join(process.cwd(),d);
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const sp = join(dd,p);
      const n = existsSync(sp) ? readdirSync(sp).filter(f=>f.endsWith('.dog')).length : 0;
      entries.push({ root: d, name: p, dogFiles: n });
    }
  }
  if (opts.json) {
    console.log(JSON.stringify(entries.map(e => e.name)));
    return;
  }
  for (const d of ['projects','specs']) {
    const projects = entries.filter(e => e.root === d);
    if (!projects.length) continue;
    console.log(chalk.bold(`\n${d}/`));
    for (const p of projects) {
      console.log(`  ${chalk.cyan(p.name)} : ${p.dogFiles} .dog files`);
    }
  }
});

program.command('parse <file>').action((f) => {
  const c = readFileSync(f,'utf-8');
  const s = parseSections(c);
  console.log(chalk.bold(`\n${s.length} sections`));
  for (const sec of s) console.log(`  ${sec.heading.padEnd(30)} ${sec.content.length} chars`);
});

// Compact injection helpers — produce token-optimized text for collar's DAG context
const COMPACT_CARD: Record<string,string> = {'1:1':'','1:N':'1m','1:many':'1m','N:1':'m1','many:1':'m1','N:M':'mm','many:many':'mm'};
function compactCard(c: string): string { const v = COMPACT_CARD[c]; return v !== undefined ? v : (c.length <= 3 ? c : c.slice(0,4)); }
function abbrevVerb(v: string): string {
  if (v.length <= 5) return v;
  const abbr: Record<string,string> = {references:'refer',implements:'imple',routes_through:'route',
    produces:'produ',refreshes:'refre',validates:'valid',triggers:'trig',complements:'compl',
    executes:'execu',queries:'queri',wired_through:'wired',polls:'polls'};
  return abbr[v] || v.slice(0,5);
}
function abbrevDag(name: string): string {
  const parts = name.replace(/[-_]/g,' ').split(/\s+/);
  return parts.length >= 2 ? parts.slice(0,2).map(p=>p[0]).join('') : name.slice(0,3);
}
function buildCompactText(project: string, v2nodes: any[][]): string {
  // Build entity→edges with compact formatting, sorted by edge count, capped at 20
  const entities: {name:string; edges:string[]; count:number}[] = [];
  const skipTypes = new Set(['prediction','state']);
  for (const n of v2nodes) {
    const name = n[1] || '';
    const type = n[2] || '';
    if (!name || skipTypes.has(type)) continue;
    const rawEdges: any[] = n[6] || [];
    if (!rawEdges.length) continue;
    const edgeStrs: string[] = [];
    for (const e of rawEdges) {
      const tgtId = e[0];
      const verb = abbrevVerb(e[1] || '');
      const card = compactCard(e[2] || '1:1');
      // Resolve target ID to name
      const tgtNode = v2nodes[tgtId];
      const tgtName = tgtNode ? (tgtNode[1] || String(tgtId)) : String(tgtId);
      edgeStrs.push(card ? `${tgtName}:${verb}(${card})` : `${tgtName}:${verb}`);
    }
    entities.push({name, edges: edgeStrs, count: edgeStrs.length});
  }
  entities.sort((a,b) => b.count - a.count);
  const top = entities.slice(0, 20);
  const lines = [`[${abbrevDag(project)}]`];
  for (const e of top) {
    lines.push(`${e.name}→${e.edges.join('>')}`);
  }
  return lines.join('\n');
}

program.command('compile [dir]').option('-o, --output <file>').option('--v2', 'Use v2 format (default: v3 for 57% smaller graphs)').action((d='.', opts) => {
  const dir = resolvePath(d);
  const layered = compileDotdogLayers(dir, safeProjectName(dir));
  if (layered) {
    console.log(chalk.green('  ✓ ' + layered.file));
    console.log(chalk.gray('    ' + layered.nodes + ' nodes, ' + layered.edges + ' edges, ' + layered.unknowns + ' unknowns'));
    return;
  }
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
              // Store property defaults in .dag (key: default_value)
              // For endpoint entities, preserve raw yaml defaults (parser may lose nested values)
              const rawYaml = (block as any).yaml?.properties || {};
              const compactProps: Record<string, string> = {};
              for (const [key, val] of Object.entries(rawYaml as Record<string, any>)) {
                if (val && typeof val === 'object' && 'default' in val) {
                  const def = val.default;
                  compactProps[key] = typeof def === 'object' ? JSON.stringify(def) : String(def);
                }
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
      // Extract infrastructure resources — they become infra nodes with edges to entities
      for (const f of files) {
        const ast = parse(sources[f]);
        for (const section of ast.sections) {
          if (!section.heading.toLowerCase().includes('infrastructure')) continue;
          for (const block of section.blocks) {
            if (block.kind !== 'prose') continue;
            const c = (block as any).content as string;
            if (!c.includes('resources:') && !c.includes('provider:')) continue;
            // Strip markdown code fences
            const clean = c.replace(/^```(yaml)?\n?/gm, '').replace(/```$/gm, '');
            const lines = clean.split('\n');
            // Quick YAML inline parse for compile (same as verify.ts parseSimpleYAML)
            const infraItems: any[] = [];
            let inInfraList = false;
            let currentObj: Record<string, string> | null = null;
            for (const raw of lines) {
              const t = raw.trimEnd();
              if (!t || t.startsWith('#') || t.startsWith('```')) continue;
              const ts = t.trimStart();
              if (ts.startsWith('- ') && ts.match(/^-\s+(\w[\w_-]*):/)) {
                // New list item
                if (currentObj) { infraItems.push(currentObj); currentObj = null; }
                inInfraList = true;
                const kv = ts.slice(2).match(/^(\w[\w_-]*):\s*(.*)/);
                if (kv) {
                  currentObj = {};
                  currentObj[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
                }
              } else if (inInfraList && currentObj && raw.trimStart() !== raw && ts.match(/^(\w[\w_-]*):/)) {
                const kv = ts.match(/^(\w[\w_-]*):\s*(.*)/);
                if (kv) {
                  const val = kv[2].trim().replace(/^['"]|['"]$/g, '');
                  if (kv[1] === 'tables' && val.startsWith('[') && val.endsWith(']')) {
                    currentObj[kv[1]] = val.slice(1, -1).split(',').map((s: string) => s.trim()).join(',');
                  } else {
                    currentObj[kv[1]] = val;
                  }
                }
              } else if (ts.match(/^(\w[\w_-]*):/) && !inInfraList) {
                // top-level key like resources:, skip
              }
            }
            if (currentObj) infraItems.push(currentObj);
            // Create infra nodes + edges
            for (const item of infraItems) {
              const provider = item.provider || '';
              const res = item.resource || '';
              const entity = item.entity || '';
              const region = item.region || '';
              const tables = item.tables || '';
              if (!provider || !res || !entity) continue;
              const nodeName = `${provider}:${res}`;
              nodes.push({
                i: nodeName,
                t: 'infra',
                g: 'resource',
                d: `${provider} ${res}`,
                p: { provider, resource: res, entity, region, tables },
                s: [],
                l: [],
              });
              // Edge from infra resource to spec entity
              edges.push({
                s: nodeName,
                t: entity,
                v: 'maps_to',
                d: '',
                c: '1:1',
                r: true,
              });
            }
          }
        }
      }
      // Validate all relationship targets reference real entities
      const entityNames = new Set(nodes.map((n: any) => n.i));
      for (const e of edges) {
        if (e.s && !entityNames.has(e.s)) {
          console.log(chalk.red(`  ✗ Unknown relationship source "${e.s}" (target: "${e.t}")`));
          process.exit(1);
        }
        if (e.t && !entityNames.has(e.t)) {
          console.log(chalk.red(`  ✗ Unknown relationship target "${e.t}" (source: "${e.s}")`));
          process.exit(1);
        }
      }

      // Build positional .dag v2 — arrays not objects, no keys, no empties
      // Schema: [id_int, name_str, type_str, desc_str, [prop_k1, prop_v1, ...], [state1, ...], [[tgt_id, verb, card?, req?], ...]]
      // Prediction nodes append: [confidence, timeframe, trigger, measurement]
      const nodeIds = new Map<string, number>();
      nodes.forEach((n, i) => nodeIds.set(n.i, i));
      const v2nodes: any[] = [];
      for (let j = 0; j < nodes.length; j++) {
        const nd = nodes[j];
        // Flatten property key-value pairs into array
        const props: any[] = [];
        if (nd.p) for (const [k, v] of Object.entries(nd.p)) props.push(k, v);
        const states = nd.s || [];
        // Build edges from source node only (no duplicate reverse edges)
        const outEdges: any[] = [];
        const seen = new Set<string>();
        for (const e of edges) {
          if (e.s !== nd.i) continue;  // only source-side edges
          const tid = nodeIds.get(e.t);
          if (tid === undefined) continue;
          const key = `${j}→${tid}:${e.v}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const ee: any[] = [tid, e.v || ''];
          if (e.c) ee.push(e.c);
          if (e.r) ee.push(1);
          outEdges.push(ee);
        }
        const entry: any[] = [j, nd.i || '', nd.t || '', nd.d || '', props, states, outEdges];
        // Predictions append forecast data
        if (nd.g === 'prediction') {
          const f: any[] = [];
          if (nd.cf) f.push(nd.cf);
          if (nd.tf) f.push(nd.tf);
          if (nd.tg) f.push(nd.tg);
          if (nd.ms) f.push(nd.ms);
          if (f.length) entry.push(f);
        }
        v2nodes.push(entry);
      }
      // Calculate token savings first (needed for v3 inline array)
      const outPath = opts.output || join(pd,`${p}.dag`);
      // Use v2 for savings calculation (v3 savings are reported separately)
      const v2dag = { v: 2, p, n: v2nodes };
      const v2Json = JSON.stringify(v2dag);
      const dagTokens = Math.round(Buffer.byteLength(v2Json,'utf-8') / 4);
      const allSavingsPct = sourceTokens > 0 ? Math.round((1 - dagTokens / sourceTokens) * 1000) / 10 : 0;
      const contentSavingsPct = contentTokens > 0 ? Math.round((1 - dagTokens / contentTokens) * 1000) / 10 : 0;
      const savingsTokens = sourceTokens - dagTokens;
      const tokens = { m: 'chars/4', st: sourceTokens, ct: contentTokens, dt: dagTokens, sv: allSavingsPct, cs: contentSavingsPct, saved: savingsTokens };

      // Build compact injection text for collar's DAG-first context
      const compact = buildCompactText(p, v2nodes);

      const v3dag = [3, p, v2nodes.map((n: any[]) => {
          const nd = nodes[n[0]];
          const tc = nd.g === 'prediction' ? 'p' : nd.t === 'infra' ? 'i' : 'e';
          const st = nd.s && nd.s.length ? nd.s : null;
          const ed = n[6] && n[6].length ? n[6] : null;
          // Strip empty values from props for token efficiency
          const cleanProps = n[4] && n[4].length ? n[4].filter((_: any, i: number) => i % 2 === 0 || n[4][i]) : null;
          const entry: any[] = [nd.i, tc, cleanProps, st, ed];
          if (nd.g === 'prediction') {
            const f: any[] = [];
            if (nd.cf != null) f.push(nd.cf);
            if (nd.tf) f.push(nd.tf);
            if (f.length) entry.push(f);
          }
          return entry;
        }), tokens];

      const dag = opts.v2 ? v2dag : v3dag;
      const dagJson = JSON.stringify(dag);
      const report: any = opts.v2 ? { ...dag, tk: tokens, compact } : [...dag, tokens];
      writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
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
      // Compute dag-only savings (strips tk metadata that inflates on-disk size)
      const dag = JSON.parse(readFileSync(dagFile,'utf-8'));
      const dagOnly = JSON.stringify({v: dag.v, p: dag.p, n: dag.n});
      const dagOnlyBytes = Buffer.byteLength(dagOnly,'utf-8');
      const dagOnlyPct = sourceBytes > 0 ? Math.round((1 - dagOnlyBytes / sourceBytes) * 1000) / 10 : 0;
      console.log(chalk.bold(`\n  ${p}`));
      console.log(chalk.gray(`    ${dogFiles.length} .dog files: ${sourceBytes} bytes`));
      console.log(chalk.gray(`    .dag on disk: ${dagBytes} bytes (${savings}% savings, includes metadata)`));
      console.log(chalk.green(`    .dag payload: ${dagOnlyBytes} bytes (${dagOnlyPct}% savings, graph only)`));
      if (contentBytes && contentBytes !== sourceBytes) {
        const cs = Math.round((1 - dagOnlyBytes / contentBytes) * 1000) / 10;
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
      const d = normalizeDag(dag); const nodes = d.n || dag.nodes || [];
      // v2 format detector: positional arrays where first element is a number
      const isV2 = (n: any) => Array.isArray(n) && typeof n[0] === 'number';
      // Get display name for a node (v2: lookup by index, v1: use i/id field)
      const nodeName = (n: any) => isV2(n) ? (nodes[n[0]] ? nodes[n[0]][1] || String(n[0]) : String(n[0])) : (n.i || n.id || '');
      // Get ID-safe slug
      const slug = (s: string) => s.replace(/\s+/g,'_').replace(/^[^a-zA-Z]+/, 'n_');
      let out = '```mermaid\ngraph LR\n';
      for (const n of nodes) {
        const raw = isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || '');
        if (raw) out += `    ${slug(raw)}[${raw}]\n`;
      }
      // Edges
      const seen = new Set<string>();
      for (const n of nodes) {
        const edges = isV2(n) ? (n[6] || []) : (n.es || []);
        for (const e of edges) {
          const srcName = isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || '');
          const src = slug(srcName);
          let tgtName: string, verb: string;
          if (isV2(n)) {
            const tgtNode = nodes[e[0]];
            tgtName = tgtNode ? (tgtNode[1] || String(tgtNode[0])) : String(e[0]);
            verb = e[1] || '';
          } else {
            tgtName = e.t || '';
            verb = e.v || '';
          }
          const tgt = slug(tgtName);
          const key = `${src}→${tgt}:${verb}`;
          if (!seen.has(key) && src && tgt) { seen.add(key); out += `    ${src} -->|${verb}| ${tgt}\n`; }
        }
      }
      // Legacy top-level edges (v1.3)
      const legacyEdges = dag.e || dag.edges || [];
      for (const e of legacyEdges) {
        const src = slug(e.s || e.source || '');
        const tgt = slug(e.t || e.target || '');
        const verb = e.v || e.verb || '';
        const key = `${src}→${tgt}:${verb}`;
        if (!seen.has(key) && src && tgt) { seen.add(key); out += `    ${src} -->|${verb}| ${tgt}\n`; }
      }
      out += '```\n';
      if (opts.save) {
        const outFile = join(dd,p,`${p}.md`);
        writeFileSync(outFile, `# ${p} : Spec Graph\n\n${out}`);
        console.log(chalk.green(`  ✓ ${outFile}`));
      }
      console.log(out);
    }
  }
});

program.command('serve [dir]').description('MCP server : expose .dag graph to AI agents over stdio').action((d='.') => serve(resolvePath(d)));

program.command('analyze [dir]').description('Analyze a spec project : score, gaps, suggestions').option('-p, --project <name>').option('--issues', 'Include GitHub issue drift summary').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold('\nSpec Analysis\n'));
  let found = false, hasGaps = false;
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
        if (f !== 'repo-map.dog') {
          allEntities.push(...entities);
          allRelationships.push(...rels);
        }
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
      for (const f of missingOpt) gaps.push(`ℹ️ ${f}: Optional file not present`);
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
      // Contradiction detection
      const contradictions: string[] = [];
      const relMap = new Map<string, RelationshipNode[]>();
      for (const r of allRelationships) {
        const key = `${r.source}→${r.target}`;
        if (!relMap.has(key)) relMap.set(key, []);
        relMap.get(key)!.push(r);
      }
      for (const [key, rels] of relMap) {
        if (rels.length > 1) {
          const verbs = [...new Set(rels.map(r => r.verb))];
          if (verbs.length > 1) contradictions.push(`🔴 Contradiction: "${key}" has conflicting verbs: ${verbs.join(', ')}`);
          else contradictions.push(`🟡 Duplicate: "${key}" appears ${rels.length} times with same verb "${verbs[0]}"`);
        }
      }
      // Check for bidirectional conflicts
      for (const r of allRelationships) {
        const reverse = allRelationships.find(r2 => r2.source === r.target && r2.target === r.source);
        if (reverse && r.verb !== reverse.verb && r.source < r.target) {
          contradictions.push(`🟡 Bidirectional: "${r.source}→${r.target}" verb "${r.verb}" vs "${reverse.source}→${reverse.target}" verb "${reverse.verb}"`);
        }
      }
      for (const c of contradictions) {
        if (c.startsWith('🔴')) hasGaps = true;
      }
      if (contradictions.length > 0) {
        console.log(chalk.bold(`\n  Contradictions (${contradictions.length})`));
        for (const c of contradictions) console.log(`  ${c}`);
      }
      if (gaps.length > 0) { console.log(chalk.bold(`\n  Gaps (${gaps.length})`)); for (const g of gaps) console.log(`  ${g}`); }
      else console.log(chalk.green('\n  No gaps found.'));
      if (gaps.length > 0) hasGaps = true;
      if (opts.issues) {
        const repo = githubRemote();
        if (repo) {
          const issues = ghIssues(repo);
          const closed = issues.filter(i => i.state === 'CLOSED');
          const drift = closed.filter(i => !allEntities.some(e => (i.title + ' ' + (i.body || '')).toLowerCase().includes(e.name.toLowerCase())));
          if (drift.length) {
            console.log(chalk.bold(`\n  Issue drift (${drift.length})`));
            for (const i of drift.slice(0, 10)) console.log(`  ℹ ${i.number} ${i.title}`);
            if (drift.length > 10) console.log(`  … and ${drift.length - 10} more`);
          } else {
            console.log(chalk.green('\n  No issue drift found.'));
          }
        }
      }
    }
  }
  if (!found) console.log(chalk.yellow('No spec projects found. Run: dotdog init <project>'));
  if (hasGaps) process.exit(1);
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
    try { parse(dm); } catch (_) { console.log(chalk.red('  ✗ Generated data-model.dog is invalid')); process.exit(1); }
    console.log(chalk.green(`  ✓ data-model.dog (${entities.length} entities)`));
  }
  // Generate COPY.dog
  if (!existsSync(join(specDir,'COPY.dog')) && uiStrings.length > 0) {
    let copy = '# App Copy\n\n| Screen | Element | Copy |\n|--------|---------|------|\n';
    for (const s of uiStrings) copy += `| ${s.screen} | ${s.element} | ${s.text} |\n`;
    writeFileSync(join(specDir,'COPY.dog'), copy);
    try { parse(copy); } catch (_) { console.log(chalk.red('  ✗ Generated COPY.dog is invalid')); process.exit(1); }
    console.log(chalk.green(`  ✓ COPY.dog (${uiStrings.length} strings)`));
  }
  // Generate INDEX.dog
  if (!existsSync(join(specDir,'INDEX.dog'))) {
    let idx = '# INDEX\n\n| You are... | Start here | Then... |\n|------------|-----------|---------|\n';
    idx += '| Developer | SPEC.dog | data-model.dog → plan.dog |\n';
    idx += '| AI agent | data-model.dog | COPY.dog → SPEC.dog |\n';
    idx += '| Designer | SPEC.dog | COPY.dog |\n';
    writeFileSync(join(specDir,'INDEX.dog'), idx);
    try { parse(idx); } catch (_) { console.log(chalk.red('  ✗ Generated INDEX.dog is invalid')); process.exit(1); }
    console.log(chalk.green('  ✓ INDEX.dog'));
  }
  console.log(chalk.bold('\nRun dotdog validate to verify.\n'));
});

program.command('simulate <scenario>').description('Walk through a scenario, check pre/postconditions').option('-p, --project <name>').action((scenario, opts) => {
  const dir = resolvePath('.');
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let projectDir = '';
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p);
      if (existsSync(join(pd,'SPEC.dog'))) { projectDir = pd; break; }
    }
    if (projectDir) break;
  }
  if (!projectDir) { console.log(chalk.red('Project not found.')); return; }
  
  // Load entities from .dag
  const dagFile = join(projectDir, `${opts.project || projectDir.split('/').pop()}.dag`);
  let entities: string[] = [], relationships: any[] = [];
  if (existsSync(dagFile)) {
    const dag = JSON.parse(readFileSync(dagFile,'utf-8'));
    const d2 = normalizeDag(dag); const simNodes = d2.n || dag.nodes || [];
    const isV2 = (n: any) => Array.isArray(n) && typeof n[0] === 'number';
    entities = simNodes.map((n: any) => (isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || '')).toLowerCase());
    // Collect edges: v2 uses positional arrays in n[5], v1.5 uses n.es, v1.3 uses top-level e/edges
    if (dag.e || dag.edges) {
      relationships = dag.e || dag.edges || [];
    } else {
      const seen = new Set<string>();
      for (const n of simNodes) {
        const edges = isV2(n) ? (n[6] || []) : (n.es || []);
        for (const e of edges) {
          const srcName = isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || '');
          const tgtName = isV2(n) ? ((simNodes[e[0]] ? simNodes[e[0]][2] : '') || String(e[0])) : (e.t || '');
          const verb = isV2(n) ? (e[1] || '') : (e.v || '');
          const key = `${srcName}→${tgtName}:${verb}`;
          if (!seen.has(key)) { seen.add(key); relationships.push({ s: srcName, t: tgtName, v: verb }); }
        }
      }
    }
  }
  
  // Read SPEC.dog for scenario descriptions
  const specFile = join(projectDir, 'SPEC.dog');
  const specContent = existsSync(specFile) ? readFileSync(specFile, 'utf-8') : '';
  
  console.log(chalk.bold(`\nSimulation: ${scenario}`));
  console.log(chalk.gray(`Project: ${projectDir.split('/').pop()} | Entities: ${entities.length} | Relationships: ${relationships.length}`));
  
  // Find scenario steps in SPEC.dog (look for numbered steps or flow descriptions)
  const steps: string[] = [];
  const stepMatches = specContent.match(/\[(\d+)\/\d+\]\s*(.+)/g);
  if (stepMatches) {
    for (const m of stepMatches) {
      const step = m.replace(/\[\d+\/\d+\]\s*/, '');
      if (step) steps.push(step);
    }
  }
  
  if (steps.length === 0) {
    console.log(chalk.yellow('\n  No scenario steps found in SPEC.dog.'));
    console.log(chalk.gray('  Add steps like: [1/3] User taps button'));
    return;
  }
  
  // Walk through steps
  let passed = 0, failed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(chalk.cyan(`\n  [${i+1}/${steps.length}] ${step}`));
    
    // Check: does this step reference known entities?
    let foundRef = false;
    for (const e of entities) {
      if (step.toLowerCase().includes(e)) {
        console.log(chalk.green(`    ✓ References entity: ${e}`));
        foundRef = true;
      }
    }
    
    // Check: does this step reference known relationships?
    for (const r of relationships) {
      const src = (r.s || r.source || '').toLowerCase();
      const tgt = (r.t || r.target || '').toLowerCase();
      const verb = (r.v || r.verb || '').toLowerCase();
      if (step.toLowerCase().includes(src) && step.toLowerCase().includes(tgt)) {
        console.log(chalk.green(`    ✓ References relationship: ${src} → ${tgt}`));
        foundRef = true;
      }
      if (verb && step.toLowerCase().includes(verb)) {
        console.log(chalk.green(`    ✓ References verb: ${verb}`));
        foundRef = true;
      }
    }
    
    if (!foundRef) {
      console.log(chalk.yellow(`    ⚠ No entity or relationship references found`));
      failed++;
    } else {
      passed++;
    }
  }
  
  // Result
  console.log(chalk.bold(`\n  RESULT: ${failed === 0 ? chalk.green('Success') : chalk.yellow('Partial')} (${passed}/${steps.length} steps passed)`));
  if (failed > 0) console.log(chalk.red(`  ${failed} steps have no spec references — entities or relationships may be missing.`));
  if (failed === 0) console.log(chalk.green('  All steps reference known entities and relationships.'));
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
        if ((text.includes('npm publish') || text.includes('npm install')) && !done) {
          const pkgPath = join(resolvePath('.'),'packages/dotdog/package.json');
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath,'utf-8'));
            if (pkg.version) { console.log(chalk.yellow(`  ⚠ Should be [x]: ${m[2].trim()}`)); issues++; }
          }
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

program.command('verify [dir]').description('Verify spec-code alignment. --init auto-generates verify section in plan.dog').option('-i, --init', 'Auto-generate verify section from codebase scan').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold(opts.init ? 'Auto-Generating Verify Section\n' : 'Verification Audit\n'));
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const planFile = join(pd,'plan.dog');
      if (!existsSync(planFile)) { console.log(chalk.yellow(`  ${p}: No plan.dog`)); continue; }
      const dagFile = join(pd,`${p}.dag`);
      if (!existsSync(dagFile)) { console.log(chalk.yellow(`  ${p}: No .dag file. Run compile first.`)); continue; }
      const dag = JSON.parse(readFileSync(dagFile,'utf-8'));
      const plan = readFileSync(planFile,'utf-8');
      
      if (opts.init) {
        // Auto-generate verify section
        const entities: string[] = [];
        const props: Map<string,string[]> = new Map();
        const d3 = normalizeDag(dag); for (const node of d3.n || []) {
          const name = node[1] || String(node[0]);
          entities.push(name);
          if (node[4]) props.set(name, node[4].map((p:any) => p[0]));
        }
        let verify = '\n## Verify\n\n';
        for (const entity of entities) {
          const nameLower = entity.toLowerCase().replace(/[^a-z0-9]/g,'');
          let matchFile = '';
          // Search codebase for matching file
          const skip = new Set(['node_modules','.git','dist','.bun','dev','build']);
          const codeDirs = [join(dir,'src'), join(dir,'lib'), join(dir,'app'), dir];
          for (const cd of codeDirs) {
            if (!existsSync(cd)) continue;
            try {
              const allFiles = readdirSync(cd, {recursive:true}).filter((f:string) => {
                if (!(f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py') || f.endsWith('.sol') || f.endsWith('.go'))) return false;
                for (const part of f.split('/')) { if (skip.has(part)) return false; }
                return true;
              });
              const match = allFiles.find((f:string) => f.toLowerCase().includes(nameLower));
              if (match) { matchFile = join(cd, match).replace(dir,'.'); break; }
            } catch(_) {}
          }

          verify += `### Entity: ${entity}\n`;
          if (matchFile) {
            verify += `  file: ${matchFile}\n`;
            // Guess properties from code
            const fullPath = join(dir, matchFile.replace('./',''));
            if (existsSync(fullPath)) {
              const code = readFileSync(fullPath,'utf-8');
              const codeProps = [...code.matchAll(/\b(\w+)\s*[:?]\s*\w+/g)].map(m => m[1]).filter((v,i,a) => a.indexOf(v)===i);
              if (codeProps.length > 0) {
                verify += `  properties: [${codeProps.slice(0,10).join(', ')}]\n`;
              }
            }
          } else {
            verify += `  # no matching file found — map manually\n`;
          }
          verify += `\n`;
        }
        // Append to plan.dog
        const updatedPlan = plan.includes('## Verify') ? plan : plan + verify;
        writeFileSync(planFile, updatedPlan);
        console.log(chalk.green(`  ${p}: Verify section generated in plan.dog`));
      } else {
        // Run verification
        const verifyMatch = plan.match(/## Verify\n([\s\S]*?)(?=\n## |$)/);
        if (!verifyMatch) { console.log(chalk.yellow(`  ${p}: No ## Verify section. Run: dotdog verify --init`)); continue; }
        const verifyBlock = verifyMatch[1];
        const entityBlocks = [...verifyBlock.matchAll(/### Entity: (\w+)\n([\s\S]*?)(?=### Entity:|$)/g)];
        let checks = 0, passed = 0;
        for (const [, ename, ebody] of entityBlocks) {
          checks++;
          const fileMatch = ebody.match(/file:\s*(.+)/);
          const propMatch = ebody.match(/properties:\s*\[([^\]]+)\]/);
          if (!fileMatch) continue;
          const filePath = join(dir, fileMatch[1].trim().replace('./',''));
          if (!existsSync(filePath)) {
            console.log(chalk.red(`  ✗ ${ename}: file ${fileMatch[1].trim()} not found`));
            continue;
          }
          const code = readFileSync(filePath,'utf-8');
          const cleanCode = code.replace(/\/\/.*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
          if (propMatch) {
            const props = propMatch[1].split(',').map(s => s.trim());
            let propPass = 0;
            for (const prop of props) {
              const snakeVariant = prop.replace(/_/g,'');
              const camelVariant = prop.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
              if (cleanCode.includes(prop) || cleanCode.includes(snakeVariant) || cleanCode.includes(camelVariant)) {
                propPass++;
              } else {
                console.log(chalk.yellow(`  ⚠ ${ename}.${prop}: not found in ${fileMatch[1].trim()}`));
              }
            }
            if (propPass === props.length) passed++;
          }
        }
        if (checks === 0) console.log(chalk.yellow(`  ${p}: No entities mapped. Run: dotdog verify --init`));
        else if (passed === checks) console.log(chalk.green(`  ${p}: ${passed}/${checks} entities verified`));
        else console.log(chalk.bold(`  ${p}: ${passed}/${checks} entities verified`));
      }
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

program.command('index [dir]').description('Build search index for semantic queries').action((d='.') => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let built = 0;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const idx = buildIndex(pd, p);
      writeFileSync(join(pd,`${p}.idx`), JSON.stringify(idx));
      console.log(chalk.green(`  ✓ ${p} : ${idx.entries.length} sections indexed (${idx.vocabulary.length} terms)`));
      built++;
    }
  }
  if (!built) console.log(chalk.yellow('No projects found. Run dotdog init first.'));
});

program.command('search <query>').description('Semantic search across compiled specs').option('-p, --project <name>').action((query, opts) => {
  console.log(chalk.bold(`\nSearch: "${query}"\n`));
  const dir = resolvePath('.');
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p);
      const idxFile = join(pd,`${p}.idx`);
      if (!existsSync(idxFile)) continue;
      found = true;
      const idx = JSON.parse(readFileSync(idxFile,'utf-8'));
      const results = searchIndex(idx, query, 8);
      if (results.length === 0) {
        console.log(chalk.gray(`  ${p}: No matches`));
        continue;
      }
      console.log(chalk.green(`  ${p} — ${results.length} results:`));
      for (const r of results) {
        const preview = r.entry.content.replace(/\n/g, ' ').slice(0, 100);
        console.log(chalk.gray(`    ${Math.round(r.score * 100)}%  [${r.entry.file}] ${r.entry.heading}`));
        console.log(chalk.gray(`         ${preview}...`));
      }
    }
  }
  if (!found) console.log(chalk.yellow('No index found. Run dotdog index first.'));
});

program.command('predictions [dir]').description('List all predictions with status').option('-p, --project <name>').action((d='.', opts) => {
  const dir = resolvePath(d);
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  console.log(chalk.bold('\nPredictions\n'));
  let found = false;
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const files = readdirSync(pd).filter(f=>f.endsWith('.dog'));
      for (const f of files) {
        const content = readFileSync(join(pd,f),'utf-8');
        const ast = parse(content);
        for (const section of ast.sections) {
          for (const block of section.blocks) {
            if (block.kind === 'prediction') {
              found = true;
              const b = block as any;
              const status = b.status || 'pending';
              const icon = status === 'correct' ? '✅' : status === 'wrong' ? '❌' : status === 'partial' ? '⚠️' : '⏳';
              console.log(`  ${icon} ${b.statement || b.name} (${(b.confidence*100).toFixed(0)}% confidence, ${status})`);
              if (b.measurement) console.log(chalk.gray(`    Measurement: ${b.measurement}`));
              if (b.timeframe) console.log(chalk.gray(`    Timeframe: ${b.timeframe}`));
            }
          }
        }
      }
    }
  }
  if (!found) console.log(chalk.yellow('No predictions found.'));
});

program.command('resolve <name>').description('Mark a prediction as correct, wrong, or partial').option('-p, --project <name>').option('--correct', 'Prediction was correct').option('--wrong', 'Prediction was wrong').option('--partial', 'Prediction was partially correct').action((name, opts) => {
  const dir = resolvePath('.');
  const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
  const status = opts.correct ? 'correct' : opts.wrong ? 'wrong' : opts.partial ? 'partial' : null;
  if (!status) { console.log(chalk.red('Specify --correct, --wrong, or --partial')); return; }
  
  for (const dd of dirs) {
    if (!existsSync(dd)) continue;
    const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
    for (const p of projects) {
      if (opts.project && p !== opts.project) continue;
      const pd = join(dd,p);
      if (!existsSync(join(pd,'SPEC.dog'))) continue;
      const files = readdirSync(pd).filter(f=>f.endsWith('.dog'));
      for (const f of files) {
        const fp = join(pd,f);
        let content = readFileSync(fp,'utf-8');
        const originalContent = readFileSync(fp, 'utf-8');
        // Find prediction block with matching statement
        const ast = parse(content);
        for (const section of ast.sections) {
          for (const block of section.blocks) {
            if (block.kind === 'prediction') {
              const b = block as any;
              if ((b.statement || b.name || '').toLowerCase().includes(name.toLowerCase())) {
                // Find prediction YAML block by heading or statement
                // Search for prediction heading at any level (both ### Prediction: Name and ### Name formats)
                let headingIdx = -1;
                const stmt = b.statement || b.name || '';
                for (const prefix of ['###', '####', '#####']) {
                  for (const fmt of [`${prefix} Prediction: ${stmt}`, `${prefix} ${stmt}`]) {
                    const idx = content.indexOf(fmt);
                    if (idx >= 0) { headingIdx = idx; break; }
                  }
                  if (headingIdx >= 0) break;
                }
                if (headingIdx >= 0) {
                  const blockStart = content.indexOf('```yaml', headingIdx);
                  const blockEnd = content.indexOf('```', blockStart + 7);
                  if (blockStart >= 0 && blockEnd >= 0) {
                    const yamlBlock = content.slice(blockStart, blockEnd + 3);
                    let newYaml = yamlBlock;
                    if (yamlBlock.includes('status:')) {
                      newYaml = yamlBlock.replace(/status:\s*\w+/, `status: ${status}`);
                    } else {
                      newYaml = yamlBlock.replace(/\n\s*(trigger|timeframe|confidence|measurement):/, `\n  status: ${status}\n$&`);
                    }
                    content = content.replace(yamlBlock, newYaml);
                    // Validate mutation produced valid .dog file
                    try {
                      parse(content);
                      writeFileSync(fp, content, 'utf-8');
                      console.log(chalk.green(`  ✓ ${b.statement || b.name}: ${status}`));
                    } catch (_) {
                      writeFileSync(fp, originalContent, 'utf-8');
                      console.log(chalk.red(`  \u2717 resolve produced invalid output for "${name}" — reverted`));
                      process.exit(1);
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  console.log(chalk.yellow(`Prediction "${name}" not found.`));
});

// Kit commands — pre-written .dog templates
const kitDir = join(resolve(import.meta.dirname || '.'), '..', 'kits');
const builtInKits = existsSync(kitDir) ? readdirSync(kitDir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name) : [];

const kitCmd = program.command('kit').description('Manage spec kits');

kitCmd.command('list').description('List available kits').action(() => {
  console.log(chalk.bold('\nAvailable kits\n'));
  if (builtInKits.length === 0) {
    console.log(chalk.gray('  No built-in kits found.'));
  } else {
    for (const k of builtInKits) {
      const specFile = join(kitDir, k, 'SPEC.dog');
      const desc = existsSync(specFile) 
        ? readFileSync(specFile,'utf-8').split('\n')[1]?.replace(/^>\s*/,'') || ''
        : '';
      console.log(`  ${chalk.green(k)}  ${chalk.gray(desc)}`);
    }
  }
  console.log(chalk.gray('\n  Community kits: npm install @scope/kit-<name> then dotdog kit install <name>'));
});

kitCmd.command('init <kit>').description('Init a project from a kit').option('-p, --project <name>').action((kit, opts) => {
  const src = join(kitDir, kit);
  if (!existsSync(src)) {
    console.log(chalk.red(`Kit "${kit}" not found. Available: ${builtInKits.join(', ')}`));
    return;
  }
  const projectName = opts.project || kit;
  const dir = resolvePath('.');
  const dest = join(dir, 'specs', projectName);
  if (existsSync(dest)) {
    console.log(chalk.yellow(`Project "${projectName}" already exists.`));
    return;
  }
  mkdirSync(dest, {recursive: true});
  const files = readdirSync(src).filter(f=>f.endsWith('.dog'));
  for (const f of files) {
    writeFileSync(join(dest, f), readFileSync(join(src, f), 'utf-8'));
    console.log(chalk.green(`  ✓ ${f}`));
  }
  console.log(chalk.gray(`\n  Kit "${kit}" initialized in specs/${projectName}/`));
  console.log(chalk.gray(`  Run: dotdog validate`));
});



program.command('badge [dir]')
  .description('Generate dotdog-badge.svg (shields.io style) showing savings')
  .action((d: string = '.') => {
    const dir = resolvePath(d);
    const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
    let found = false;
    for (const dd of dirs) {
      if (!existsSync(dd)) continue;
      const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
      for (const p of projects) {
        const pd = join(dd,p);
        const dagFile = join(pd, `${p}.dag`);
        if (!existsSync(join(pd,'SPEC.dog'))) continue;
        if (!existsSync(dagFile)) { console.log(chalk.red(`  No .dag for ${p}. Run dotdog compile first.`)); continue; }
        const rawDag = JSON.parse(readFileSync(dagFile,'utf-8'));
        const dag = normalizeDag(rawDag);
        const saved = dag.tk && dag.tk.saved ? dag.tk.saved : 0;
        const fmt = saved >= 1000 ? `${(saved/1000).toFixed(1)}K` : `${saved}`;
        
        const label = 'dotdog';
        const value = `${fmt} tokens saved`;
        const pct = dag.tk && dag.tk.sv ? dag.tk.sv : 0;
        const color = pct > 90 ? '#4c1' : pct > 70 ? '#dfb317' : '#e05d44';
        
        const labelLen = Math.round(label.length * 7.2);
        const valueLen = Math.round(value.length * 7.2);
        const leftW = Math.max(labelLen + 10, 70);
        const rightW = Math.max(valueLen + 10, 40);
        const totalW = leftW + rightW;
        const leftX = leftW / 2 * 10;
        const rightX = (leftW + rightW / 2) * 10;
        
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftW}" height="20" fill="#555"/>
    <rect x="${leftW}" width="${rightW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <g transform="scale(.1)">
      <text x="${leftX}" y="140" textLength="${labelLen * 10}">${label}</text>
      <text x="${rightX}" y="140" textLength="${valueLen * 10}">${value}</text>
    </g>
  </g>
</svg>`;
        writeFileSync(join(dir, 'dotdog-badge.svg'), svg);
        console.log(chalk.green(`  \u2713 dotdog-badge.svg  (${label}: ${value})`));
        found = true;
      }
    }
    if (!found) console.log(chalk.yellow('No projects found. Run dotdog init first.'));
  });


program.command('doctor')
  .description('Baseline health check — validate specs, detect stale .dag')
  .option('--json', 'Machine-readable JSON output')
  .action((opts: { json?: boolean }) => {
    const dir = resolvePath('.');
    const dirs = [join(dir,'projects'),join(dir,'specs'),dir];
    let found = false, passed = 0, failed = 0;
    const results: Array<{project:string,status:string,error?:string}> = [];

    for (const dd of dirs) {
      if (!existsSync(dd)) continue;
      const projects = readdirSync(dd,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
      for (const p of projects) {
        const pd = join(dd,p);
        if (!existsSync(join(pd,'SPEC.dog'))) continue;
        found = true;
        const dogFiles = readdirSync(pd).filter(f=>f.endsWith('.dog'));
        // Check 1: validate completeness
        const missing = ['SPEC.dog','constitution.dog','data-model.dog'].filter(f=>!dogFiles.includes(f));
        if (missing.length) {
          const msg = `missing ${missing.join(', ')}`;
          if (opts.json) results.push({project:p,status:'fail',error:msg});
          else console.log(chalk.red(`  ✗ ${p}: ${msg}`));
          failed++;
          continue;
        }
        // Check 2: stale .dag
        const dagFile = join(pd,`${p}.dag`);
        if (!existsSync(dagFile)) {
          const msg = 'no .dag — run dotdog compile';
          if (opts.json) results.push({project:p,status:'fail',error:msg});
          else console.log(chalk.yellow(`  ✗ ${p}: ${msg}`));
          failed++;
          continue;
        }
        // Guard against corrupted .dag
        let dagMtime: number;
        try {
          dagMtime = statSync(dagFile).mtimeMs;
          JSON.parse(readFileSync(dagFile,'utf-8'));
        } catch {
          const msg = 'corrupted .dag — run dotdog compile';
          if (opts.json) results.push({project:p,status:'fail',error:msg});
          else console.log(chalk.red(`  ✗ ${p}: ${msg}`));
          failed++;
          continue;
        }
        const stale = dogFiles.filter(f => statSync(join(pd,f)).mtimeMs > dagMtime);
        if (stale.length) {
          const msg = `stale .dag (${stale.join(', ')} newer)`;
          if (opts.json) results.push({project:p,status:'fail',error:msg});
          else {
            console.log(chalk.red(`  ✗ ${p}: ${msg}`));
            console.log(chalk.gray(`     Run: dotdog compile`));
          }
          failed++;
        } else {
          if (opts.json) results.push({project:p,status:'pass'});
          else console.log(chalk.green(`  ✓ ${p}`));
          passed++;
        }
      }
    }
    if (opts.json) {
      console.log(JSON.stringify({passed,failed,total:passed+failed,results}));
    } else {
      if (!found) console.log(chalk.yellow('No projects found. Run dotdog init first.'));
      else console.log(chalk.bold(`\n  ${passed + failed} checks: ${passed} passed, ${failed} failed`));
    }
    if (failed) process.exit(1);
  });


program.command('convert <file>')
  .description('Convert an .md file to .dog — rename + validate')
  .action((f: string) => {
    const { existsSync, renameSync, readFileSync, writeFileSync } = require('fs');
    const { join, dirname, basename } = require('path');
    const path = resolvePath(f);
    if (!existsSync(path)) { console.log(chalk.red(`File not found: ${f}`)); return; }
    if (!path.endsWith('.md')) { console.log(chalk.yellow(`Only .md files can be converted.`)); return; }
    const dogPath = path.replace(/\.md$/, '.dog');
    if (existsSync(dogPath)) { console.log(chalk.yellow(`${dogPath} already exists.`)); return; }
    const content = readFileSync(path, 'utf-8');
    renameSync(path, dogPath);
    if (!content.match(/^##\s/m)) {
      const stub = '## Product\n\n(Describe your product here)\n';
      writeFileSync(dogPath, stub + content);
    }
    console.log(chalk.green(`  ✓ ${basename(path)} → ${basename(dogPath)}`));
    console.log(chalk.gray('  Run: dotdog validate'));
  });

program.command('live [entity]')
  .description('Test live endpoints or infrastructure defined in .dog specs')
  .option('--exit-code', 'Return non-zero on drift/unreachable')
  .option('--timeout <s>', 'Per-request timeout in seconds', '10')
  .option('--type <type>', 'endpoint, infra, or all (default: all)')
  .action(async (entityFilter: string | undefined, opts: { exitCode?: boolean; timeout?: string; type?: string }) => {
    const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
    const { join, dirname } = require('path');
    const timeout = parseInt(opts.timeout || '10') * 1000;
    const checkType = (opts.type || 'all').toLowerCase();

    const dir = resolvePath('.');
    const endpoints: { name: string; url: string; backupUrl?: string; expectStatus: number; expectBody: any; file: string }[] = [];
    let infraDagNodes: any[] = [];

    // --- Try .dag first (token-efficient) ---
    const dagDirs = [join(dir,'projects'),join(dir,'specs'),dir];
    let dagLoaded = false;
    const dagFiles: string[] = [];
    for (const dd of dagDirs) {
      if (!existsSync(dd)) continue;
      // Check for .dag files directly in this directory
      try {
        for (const entry of readdirSync(dd)) {
          if (entry.endsWith('.dag')) dagFiles.push(join(dd, entry));
        }
      } catch {}
      // Also check subdirectories (projects/specs pattern)
      let projects: string[] = [];
      try { projects = readdirSync(dd, {withFileTypes:true}).filter((e: any) => e.isDirectory()).map((e: any) => e.name); } catch { continue; }
      for (const p of projects) {
        const dagFile = join(dd, p, `${p}.dag`);
        if (existsSync(dagFile)) dagFiles.push(dagFile);
      }
    }
    for (const dagFile of dagFiles) {
      let dag: any;
      try { dag = JSON.parse(readFileSync(dagFile,'utf-8')); } catch { continue; }
      dagLoaded = true;
        const nodes = dag.n || [];
        const isV2 = (n: any) => Array.isArray(n) && typeof n[0] === 'number';
        const Nm = (n: any) => isV2(n) ? (n[1] || String(n[0])) : (n.i || n.id || n.name || '');
        const Nt = (n: any) => isV2(n) ? (n[2] || '') : (n.t || n.type || '');
        const Np = (n: any) => {
          if (isV2(n)) {
            const flat = n[4] || [];
            const obj: Record<string,string> = {};
            for (let i = 0; i < flat.length; i += 2) obj[flat[i]] = flat[i+1] || '';
            return obj;
          }
          return n.p || n.properties || {};
        };
        for (const node of nodes) {
          const t = Nt(node);
          if (t === 'endpoint' && (checkType === 'endpoint' || checkType === 'all')) {
            const props = Np(node);
            const url = props.url || props.default_url || '';
            if (!url) continue;
            if (entityFilter && Nm(node) !== entityFilter) continue;
            endpoints.push({
              name: Nm(node),
              url,
              backupUrl: props.backup_url || props.backupUrl || undefined,
              expectStatus: parseInt(props.expect_status || props.expectStatus || '200') || 200,
              expectBody: (() => { try { return props.expect_body ? JSON.parse(props.expect_body) : null; } catch { return null; } })(),
              file: dagFile,
            });
          }
          if (t === 'infra' && (checkType === 'infra' || checkType === 'all')) {
            const props = Np(node);
            infraDagNodes.push({
              entity: props.entity || '',
              provider: props.provider || '',
              resource: props.resource || '',
              region: props.region || '',
              tables: props.tables || '',
            });
          }
        }
    }

    // --- Fall back to .dog scanning if no .dag ---
    if (!dagLoaded && (checkType === 'endpoint' || checkType === 'all')) {
      const files: string[] = [];
      function scan(d: string) {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const p = join(d, entry.name);
          if (entry.isDirectory()) scan(p);
          else if (entry.name.endsWith('.dog')) files.push(p);
        }
      }
      scan(dir);
      const { parse } = require('./parser');
      for (const f of files) {
        try {
          const content = readFileSync(f, 'utf-8');
          const ast = parse(content);
          for (const section of ast.sections) {
            for (const block of section.blocks) {
              if (block.kind === 'entity' && block.type === 'endpoint') {
                const url = block.properties?.url?.default as string;
                if (!url) continue;
                const name = block.name;
                if (entityFilter && name !== entityFilter) continue;
                endpoints.push({
                  name, url,
                  backupUrl: block.properties?.backup_url?.default as string | undefined,
                  expectStatus: (block.properties?.expect_status?.default as number) || 200,
                  expectBody: block.properties?.expect_body?.default || null,
                  file: f,
                });
              }
            }
          }
        } catch { /* skip unparseable files */ }
      }
    }

    // Print endpoint section
    if (!endpoints.length && checkType === 'endpoint') {
      console.log(chalk.yellow('No endpoint contracts found. Add an endpoint entity to a .dog file:\n'));
      console.log(chalk.gray('  ### Endpoint: my-api'));
      console.log(chalk.gray('  ```yaml'));
      console.log(chalk.gray('  entity: my-api'));
      console.log(chalk.gray('  type: endpoint'));
      console.log(chalk.gray('  properties:'));
      console.log(chalk.gray('    url: { type: string, default: "https://..." }'));
      console.log(chalk.gray('    expect_body: { type: json, default: { ... } }'));
      console.log(chalk.gray('  ```'));
      process.exit(0);
    }

    // Hit each endpoint
    let passed = 0, degraded = 0, failed = 0, unreachable = 0;

    for (const ep of endpoints) {
      const urls = [ep.url];
      if (ep.backupUrl) urls.push(ep.backupUrl);
      let matched = false, usedBackup = false;

      for (const u of urls) {
        const isBackup = u !== ep.url;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);
          const res = await fetch(u, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
          clearTimeout(timer);
          if (res.status !== ep.expectStatus) {
            if (!isBackup) continue;
            else { console.log(chalk.red(`  ✗ ${ep.name}: ${u} → status ${res.status} (expected ${ep.expectStatus})`)); unreachable++; break; }
          }
          const body = await res.json().catch(() => null);
          if (ep.expectBody && body) {
            const drift = diffBody(ep.expectBody, body);
            if (drift.missing.length > 0) {
              if (!isBackup) continue;
              else { console.log(chalk.red(`  ✗ ${ep.name}: ${u} — missing fields: ${drift.missing.join(', ')}`)); failed++; break; }
            }
            if (drift.extra.length > 0) {
              console.log(chalk.yellow(`  ⚠ ${ep.name}: ${u} — new fields: ${drift.extra.join(', ')}`));
            }
          }
          matched = true; usedBackup = isBackup; break;
        } catch (e: any) {
          if (!isBackup) continue;
          else { console.log(chalk.red(`  ✗ ${ep.name}: ${u} — ${e.message}`)); unreachable++; break; }
        }
      }

      if (matched) {
        if (usedBackup) { console.log(chalk.yellow(`  ⚠ ${ep.name}: ${ep.backupUrl} (backup, primary failed)`)); degraded++; }
        else { console.log(chalk.green(`  ✓ ${ep.name}`)); passed++; }
      } else {
        console.log(chalk.red(`  ✗ ${ep.name}: primary + backup unreachable`));
        unreachable++;
      }
    }

    const total = passed + degraded + failed + unreachable;

    // --- Infrastructure verification (from .dag or fallback) ---
    let infraResults: any[] = [];

    if (checkType === 'infra' || checkType === 'all') {
      if (infraDagNodes.length > 0) {
        // Use .dag nodes — run provider checks directly
        const { verifyInfra } = require('./infra/verify');
        for (const node of infraDagNodes) {
          if (entityFilter && node.entity !== entityFilter) continue;
          const filtered = await verifyInfra({
            dir,
            providerFilter: node.provider,
            entityFilter: node.entity,
          });
          infraResults.push(...filtered);
        }
      } else {
        // Fall back to .dog scanning
        const { verifyInfra } = require('./infra/verify');
        infraResults = await verifyInfra({
          dir,
          entityFilter: entityFilter && checkType === 'infra' ? entityFilter : undefined,
        });
      }
    }

    // Print infra results (deduplicated)
    if (infraResults.length > 0 && (checkType === 'infra' || checkType === 'all')) {
      // Deduplicate by entity+provider+resource
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const r of infraResults) {
        const key = `${r.entity}||${r.provider}||${r.resource}`;
        if (!seen.has(key)) { seen.add(key); deduped.push(r); }
      }
      infraResults = deduped;
      const allSkip = infraResults.every((r: any) => r.status === 'skip');
      if (allSkip) {
        console.log(chalk.gray('\nInfrastructure — skipped (no provider tokens set)'));
        for (const r of infraResults) {
          console.log(chalk.gray(`  — ${r.entity.padEnd(14)} ${r.provider} ${r.resource}  ${r.message}`));
        }
      } else {
        console.log(chalk.bold('\nInfrastructure'));
        let infraPass = 0, infraFail = 0, infraWarn = 0;
        for (const r of infraResults) {
          const icon = r.status === 'pass' ? chalk.green('  ✓') :
                       r.status === 'fail' ? chalk.red('  ✗') :
                       r.status === 'warn' ? chalk.yellow('  ⚠') : chalk.gray('  —');
          const label = r.entity ? `${r.entity.padEnd(14)} ${r.provider} ${r.resource}` : `${r.provider} ${r.resource}`;
          console.log(`${icon} ${label.padEnd(48)} ${r.message}${r.detail ? chalk.gray(' (' + r.detail.slice(0, 80) + ')') : ''}`);
          if (r.children) {
            for (const c of r.children) {
              const cIcon = c.status === 'pass' ? chalk.green('    ✓') :
                            c.status === 'fail' ? chalk.red('    ✗') : chalk.gray('    —');
              console.log(`${cIcon} ${c.resource.padEnd(44)} ${c.message}`);
            }
          }
          if (r.status === 'pass') infraPass++;
          else if (r.status === 'fail') infraFail++;
          else if (r.status === 'warn') infraWarn++;
        }
        const infraTotal = infraPass + infraFail + infraWarn;
        console.log(chalk.bold(`\n  ${infraTotal} resources: ${chalk.green(infraPass + ' verified')}${infraFail ? chalk.red(', ' + infraFail + ' missing') : ''}${infraWarn ? chalk.yellow(', ' + infraWarn + ' warn') : ''}`));
      }
    }

    if (!endpoints.length && infraResults.length === 0 && checkType !== 'infra') {
      console.log(chalk.yellow('No endpoint contracts or infrastructure resources found. Add to a .dog file:\n'));
      console.log(chalk.gray('  Endpoint: ### Endpoint: my-api with type: endpoint'));
      console.log(chalk.gray('  Infra:    ### Infrastructure with resources list'));
      process.exit(0);
    }
    if (endpoints.length > 0) {
      console.log(chalk.bold(`\n  ${total} endpoints: ${chalk.green(passed + ' passed')}${degraded ? chalk.yellow(', ' + degraded + ' degraded') : ''}${failed ? chalk.red(', ' + failed + ' failed') : ''}${unreachable ? chalk.red(', ' + unreachable + ' unreachable') : ''}`));
    }

    if (opts.exitCode) {
      if (failed > 0) process.exit(1);
      if (unreachable > 0) process.exit(2);
      if (degraded > 0) process.exit(3);
    }
  });

// Deep diff — returns missing and extra top-level keys
function diffBody(expected: Record<string, unknown>, actual: Record<string, unknown>): { missing: string[]; extra: string[] } {
  const expKeys = Object.keys(expected);
  const actKeys = Object.keys(actual);
  const missing = expKeys.filter(k => !(k in actual));
  const extra = actKeys.filter(k => !(k in expected));
  return { missing, extra };
}


program
  .command('map [dir]')
  .description('Map a repository into a machine-readable repo.dag world model')
  .option('-p, --project <name>', 'project name')
  .option('--json', 'print write result as JSON')
  .action((dir = '.', opts) => {
    const projectName = opts.project || safeProjectName(resolve(dir));
    const specDir = resolve(dir, '.dotdog', 'generated');
    const result = writeRepoMap(resolve(dir), projectName, specDir);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`wrote ${result.dagFile}`);
    console.log(`${result.facts} facts, ${result.edges} edges`);
  });

program
  .command('query <term>')
  .description('Query a repo.dag world model')
  .option('--dag <file>', 'path to repo.dag', '.dotdog/compiled/repo.dag')
  .option('-l, --limit <n>', 'max results', '10')
  .action((term, opts) => {
    const world = loadWorldModel(resolve(opts.dag));
    const result = queryWorldModel(world, term, Number(opts.limit || 10));
    console.log(formatQueryResult(result));
  });

program
  .command('trace <node>')
  .description('Trace repo.dag relationships for a node')
  .option('--dag <file>', 'path to repo.dag', '.dotdog/compiled/repo.dag')
  .option('-d, --depth <n>', 'trace depth', '2')
  .action((node, opts) => {
    const world = loadWorldModel(resolve(opts.dag));
    const result = traceWorldNode(world, node, Number(opts.depth || 2));
    console.log(formatTrace(result));
  });

program.parse();
