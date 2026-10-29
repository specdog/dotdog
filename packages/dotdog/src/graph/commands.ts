import { atomicWrite } from '../workspace/files';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import type { Command } from 'commander';
import { auditGraph } from './audit';
import { budgetContext } from './context';
import { readGraphText } from './io';
import { resolveUserPath, safeOutputPath } from '../workspace/paths';
import { normalizeGraph, graphNeighborhood, type GraphNode, type GraphEdge } from './model';

export function importReaCallGraph(input: any, project: string, source: string, digest: string, artifact?: string) {
  if (!input?.graph || typeof input.graph !== 'object' || Array.isArray(input.graph) || !Array.isArray(input.limitations) || input.limitations.some((item: any) => typeof item !== 'string')) throw new Error('Expected a REA NativeCallGraph export: graph and limitations');
  if (artifact && !/^[a-f0-9]{64}$/i.test(artifact)) throw new Error('artifact-sha256 must be a SHA-256 digest');
  const namespace = artifact || digest;
  const nodes = new Map<string, GraphNode>(), edges = new Map<string, GraphEdge>();
  const id = (address: string) => `rea:${namespace}:${address}`;
  const add = (address: string) => {
    if (typeof address !== 'string' || !address) throw new Error('REA address must be a nonempty string');
    if (!nodes.has(id(address))) nodes.set(id(address), {
      id: id(address), label: address, kind: 'function', properties: { address, artifactSha256: artifact || 'unknown' },
      schema: {}, states: [], lifecycle: [], confidence: 'unknown', source,
      origin: { type: 'imported', provider: 'rea', file: source, digest },
    });
    return nodes.get(id(address))!;
  };
  const limitations = [...input.limitations];
  if (!artifact) limitations.push('Binary identity was not supplied; IDs are scoped to the exported evidence digest, not a verified binary.');
  let partial = false;
  for (const rows of Object.values(input.graph) as any[]) {
    if (!Array.isArray(rows)) throw new Error('Each REA graph level must be an array');
    for (const row of rows) {
      if (!row || !['ok', 'error'].includes(row.status)) throw new Error('Invalid REA traversal status');
      const node = add(row.address);
      node.evidence = [...((node.evidence as any[]) || []), row];
      if (row.status === 'error') { if (!row.error || typeof row.error !== 'object') throw new Error('REA error row requires error evidence'); partial = true; continue; }
      if (!Array.isArray(row.calls) || !row.relationship_coverage || !['complete', 'partial', 'unknown'].includes(row.relationship_coverage.status)) throw new Error('REA row requires calls and relationship_coverage');
      if (row.relationship_coverage.status === 'partial' && (!Array.isArray(row.relationship_coverage.limitations) || !row.relationship_coverage.limitations.length || row.relationship_coverage.limitations.some((item: any) => typeof item !== 'string' || !item))) throw new Error('Partial REA coverage requires limitations');
      if (row.relationship_coverage.status === 'unknown' && (typeof row.relationship_coverage.reason !== 'string' || !row.relationship_coverage.reason)) throw new Error('Unknown REA coverage requires a reason');
      partial ||= row.relationship_coverage.status !== 'complete';
      node.confidence = 'certain';
      for (const address of row.calls) {
        const target = add(address), edgeId = `${node.id}:calls:${target.id}`;
        edges.set(edgeId, { id: edgeId, sourceId: node.id, targetId: target.id, verb: 'calls', confidence: 'certain', origin: node.origin, evidence: { source, sha256: digest, relationship_coverage: row.relationship_coverage } });
      }
    }
  }
  return { project, version: '1.0', nodes: [...nodes.values()], edges: [...edges.values()], coverage: { status: partial ? 'partial' : 'unknown', scope: 'supplied REA traversal only' }, limitations };
}

export function registerGraphCommands(program: Command) {
  for (const command of ['context', 'impact']) {
    const query = program.command(`${command} <node>`)
      .description(command === 'impact' ? 'Bounded reverse dependency graph for a proposed change' : 'Bounded evidence-linked context around a graph node')
      .option('--dag <file>', 'compiled graph', '.doghouse/compiled/repo.dag')
      .option('--depth <n>', 'maximum traversal depth', '2')
      .option('--limit <n>', 'maximum returned nodes', '100')
      .option('--json', 'print JSON')
      .action(async (node, opts) => {
        if (opts.task !== undefined && opts.maxTokens === undefined) throw new Error('--task requires --max-tokens');
        const graph = normalizeGraph(JSON.parse(readGraphText(resolveUserPath(opts.dag))));
        const neighborhood = graphNeighborhood(graph, node, { direction: command === 'impact' ? 'incoming' : 'any', depth: Number(opts.depth), limit: Number(opts.limit) });
        const result = opts.maxTokens === undefined ? neighborhood : await budgetContext(neighborhood, Number(opts.maxTokens), opts.task);
        if (!result.ok) process.exitCode = 1;
        if (opts.maxTokens !== undefined) console.log(JSON.stringify(result));
        else if (opts.json) console.log(JSON.stringify(result, null, 2));
        else {
          for (const item of result.nodes || []) console.log(`${item.kind} ${item.label}${item.source ? ' [' + item.source + ']' : ''}`);
          if (!result.ok) console.error(result.error);
          if (result.truncated) console.error('Result truncated; increase --limit or narrow the query.');
        }
      });
    if (command === 'context') query.option('--max-tokens <n>', 'compact JSON text budget in o200k_base tokens (128–131072)')
      .option('--task <text>', 'lexical task ranking within the neighborhood; requires --max-tokens');
  }
  const graph = program.command('graph').description('Import, export and inspect interoperable evidence-linked graphs');
  graph.command('audit').description('Read-only evidence identity/freshness and optional embodied-system coverage')
    .option('--dag <file>', 'graph to inspect', '.doghouse/compiled/repo.dag')
    .option('--profile <profile>', 'evidence or embodied', 'evidence')
    .option('--max-age-days <days>', 'evidence freshness window', '30')
    .option('--json', 'print JSON').action(opts => {
      const data = normalizeGraph(JSON.parse(readGraphText(resolveUserPath(opts.dag))));
      const result = auditGraph(data, process.cwd(), { profile: opts.profile, maxAgeDays: Number(opts.maxAgeDays) });
      if (!result.ok) process.exitCode = 1;
      console.log(opts.json ? JSON.stringify(result, null, 2) : `${result.ok ? 'Evidence checks passed' : 'Evidence gaps found'}: ${result.validEvidence}/${result.evidence} current artifacts\n${result.findings.map(item => `${item.node}: ${item.code}: ${item.message}`).join('\n')}\nAdvisory only; not safety certification or actuation permission.`);
    });
  graph.command('import <file>')
    .option('--format <format>', 'dotdog or rea-callgraph', 'dotdog')
    .requiredOption('--project <name>', 'project namespace')
    .option('--artifact-sha256 <digest>', 'binary content identity for REA addresses')
    .option('--force', 'replace a previously imported project')
    .action((file, opts) => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(opts.project)) throw new Error('Invalid project name');
      const input = resolveUserPath(file), source = relative(process.cwd(), input).replace(/\\/g, '/');
      const bytes = readGraphText(input), raw = JSON.parse(bytes);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const imported = opts.format === 'rea-callgraph' ? importReaCallGraph(raw, opts.project, source, digest, opts.artifactSha256) : opts.format === 'dotdog' ? { ...normalizeGraph(raw), project: opts.project } : undefined;
      if (!imported) throw new Error('Unsupported graph format');
      normalizeGraph(imported);
      const directory = resolveUserPath('.doghouse/imported');
      mkdirSync(directory, { recursive: true });
      const destination = safeOutputPath(join(directory, opts.project + '.dag'));
      if (existsSync(destination) && !opts.force) throw new Error('Imported project exists; use --force to replace it');
      atomicWrite(process.cwd(), destination, JSON.stringify(imported, null, 2) + '\n');
      console.log(JSON.stringify({ project: opts.project, file: relative(process.cwd(), destination), sourceSha256: digest, nodes: imported.nodes.length, edges: imported.edges.length }));
    });
  graph.command('export')
    .option('--dag <file>', 'compiled graph', '.doghouse/compiled/repo.dag')
    .option('--format <format>', 'json or mermaid', 'json')
    .action(opts => {
      const data = normalizeGraph(JSON.parse(readGraphText(resolveUserPath(opts.dag))));
      if (opts.format === 'json') console.log(JSON.stringify({ version: '1.0', ...data }, null, 2));
      else if (opts.format === 'mermaid') {
        const ids = new Map(data.nodes.map((node, index) => [node.id, `n${index}`]));
        console.log('graph LR');
        for (const node of data.nodes) console.log(`  ${ids.get(node.id)}[${JSON.stringify(node.label.replace(/[<>]/g, ''))}]`);
        for (const edge of data.edges) console.log(`  ${ids.get(edge.sourceId)} -->|${JSON.stringify(edge.verb)}| ${ids.get(edge.targetId)}`);
      } else throw new Error('Unsupported export format');
    });
}
