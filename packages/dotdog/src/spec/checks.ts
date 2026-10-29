import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import type { Command } from 'commander';
import { normalizeGraph } from '../graph/model';
import { resolveUserPath } from '../workspace/paths';

function projects(root: string, name?: string) {
  const candidates = existsSync(join(root, 'SPEC.dog')) ? [root] : ['specs', 'projects', '.'].flatMap(folder => {
    const directory = resolveUserPath(folder, root);
    return existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(directory, entry.name)) : [];
  });
  const selected = [...new Set(candidates)].filter(directory => (!name || basename(directory) === name) && existsSync(join(directory, 'SPEC.dog')));
  if (!selected.length) throw new Error('No matching spec project');
  return selected.map(directory => resolveUserPath(directory, root));
}

const token = (text: string, word: string) => new RegExp(`(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'i').test(text);

export function scenarioCheck(directory: string, name: string) {
  const project = basename(directory);
  const graph = normalizeGraph(JSON.parse(readFileSync(resolveUserPath(`${project}.dag`, directory), 'utf8')));
  const lines = readFileSync(resolveUserPath('SPEC.dog', directory), 'utf8').split(/\r?\n/);
  let level = 0, selected = false, matches = 0;
  const steps: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(?:Scenario|Flow):\s*(.+?)\s*$/i);
    if (heading && heading[2].toLowerCase() === name.toLowerCase()) { matches++; level = heading[1].length; selected = true; continue; }
    const anyHeading = line.match(/^(#{1,6})\s/);
    if (anyHeading && anyHeading[1].length <= level) selected = false;
    const step = selected && line.match(/^\s*(?:\[\d+\/\d+\]|\d+[.)])\s+(.+)/);
    if (step) steps.push(step[1]);
  }
  const checked = steps.map(text => ({ text, entities: graph.nodes.filter(node => token(text, node.label)).map(node => node.id) }));
  return { project, scenario: name, ok: matches === 1 && checked.length > 0 && checked.every(step => step.entities.length > 0), matches, steps: checked, limitation: 'Lexical entity references only; no application execution or relationship correctness proof.' };
}

export function referenceCheck(root: string, directory: string) {
  const planFile = resolveUserPath('plan.dog', directory);
  if (!existsSync(planFile)) return { project: basename(directory), ok: false, mappings: [], limitation: 'No plan.dog with explicit Verify mappings' };
  const plan = readFileSync(planFile, 'utf8');
  const section = plan.match(/^## Verify\s*\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m)?.[1] || '';
  const graph = normalizeGraph(JSON.parse(readFileSync(resolveUserPath(`${basename(directory)}.dag`, directory), 'utf8')));
  const mappings = [...section.matchAll(/^### Entity:\s*(.+?)\s*\r?\n([\s\S]*?)(?=^###\s|$(?![\s\S]))/gm)].map(([, entity, body]) => {
    const file = body.match(/^\s*file:\s*(.+)$/m)?.[1].trim();
    const properties = body.match(/^\s*properties:\s*\[([^\]]*)\]/m)?.[1].split(',').map(value => value.trim()).filter(Boolean) || [];
    try {
      if (!graph.nodes.some(node => node.id === entity || node.label === entity)) throw new Error('Unknown graph entity');
      if (!file) throw new Error('No explicit file mapping');
      const path = resolveUserPath(file, root);
      const code = readFileSync(path, 'utf8');
      const missing = properties.filter(property => !token(code, property));
      return { entity, file, ok: !missing.length, missing };
    } catch (error) { return { entity, file, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  return { project: basename(directory), ok: mappings.length > 0 && mappings.every(mapping => mapping.ok), mappings, limitation: 'Explicit file existence and lexical property references only; comments and strings may match. No runtime verification.' };
}

export function registerSpecChecks(program: Command) {
  for (const name of ['scenario-check', 'simulate']) {
    program.command(`${name} <scenario>`).description('Check a named scenario for compiled entity references; no execution')
      .option('-p, --project <name>').option('--json').action((scenario, opts) => {
        if (name === 'simulate') console.error('Deprecated: use dotdog scenario-check. This is not a simulation.');
        const result = projects(process.cwd(), opts.project).map(directory => scenarioCheck(directory, scenario));
        if (!result.every(project => project.ok)) process.exitCode = 1;
        console.log(opts.json ? JSON.stringify(result) : result.map(project => `${project.project}: ${project.ok ? 'references found' : 'missing, ambiguous or unmatched scenario steps'} (${project.steps.length} steps)`).join('\n'));
      });
  }
  for (const name of ['reference-check', 'verify']) {
    program.command(`${name} [dir]`).description('Check explicit Verify mappings; read-only lexical diagnostic')
      .option('-p, --project <name>').option('--json').option('-i, --init', 'retired: mappings must be authored explicitly').action((dir = '.', opts) => {
        if (name === 'verify') console.error('Deprecated: use dotdog reference-check. This does not prove code alignment.');
        if (opts.init) throw new Error('--init is retired: author explicit Verify file/property mappings; Dotdog will not guess or write plan.dog.');
        const root = resolveUserPath(dir);
        const result = projects(root, opts.project).map(directory => referenceCheck(root, directory));
        if (!result.every(project => project.ok)) process.exitCode = 1;
        console.log(opts.json ? JSON.stringify(result) : result.map(project => `${project.project}: ${project.mappings.filter(mapping => mapping.ok).length}/${project.mappings.length} explicit mappings found`).join('\n'));
      });
  }
}
