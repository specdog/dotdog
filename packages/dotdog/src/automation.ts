import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, lstatSync, unlinkSync } from 'fs';
import { join, dirname, relative } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import type { Command } from 'commander';
import { listRepoFiles, safeProjectName, writeRepoMap } from './map/repoMapper';
import { compileDotdogLayers } from './dag/layers';
import { normalizeGraph } from './graph/model';
import { resolveUserPath } from './workspace/paths';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function invoke(root: string, args: string[]) {
  return execFileSync(process.execPath, [process.argv[1], ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function refreshGraph(root: string, onlyStale = false) {
  const files = listRepoFiles(root).filter(file => !/\.(dag|idx)$/.test(file) && file !== 'dotdog-badge.svg');
  for (const directory of ['semantic', 'overlays']) {
    const base = join(root, '.doghouse', directory);
    if (existsSync(base)) resolveUserPath(base, root);
    if (existsSync(base)) for (const file of listRepoFiles(base)) files.push(`.doghouse/${directory}/${file}`);
  }
  files.sort();
  const hash = digest(version + '\n' + files.map(file => `${file}\0${digest(readFileSync(join(root, file)))}`).join('\n'));
  const directory = join(root, '.doghouse'), stateFile = join(directory, 'refresh.json');
  const dagFile = join(directory, 'compiled/repo.dag');
  let previous: any = null;
  try { previous = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  const unchanged = previous?.inputHash === hash && existsSync(dagFile) && previous.outputHash === digest(readFileSync(dagFile)) && Object.entries(previous.outputHashes || {}).every(([file, hash]) => existsSync(join(root, file)) && digest(readFileSync(join(root, file))) === hash);
  if (onlyStale && unchanged) return { ok: true, changed: false, inputHash: hash, nodes: previous.nodes, edges: previous.edges, added: [], changedIds: [], removed: [] };
  let oldGraph: ReturnType<typeof normalizeGraph> | { nodes: []; edges: [] } = { nodes: [], edges: [] };
  let diffAvailable = true;
  try { if (existsSync(dagFile)) oldGraph = normalizeGraph(JSON.parse(readFileSync(dagFile, 'utf8'))); }
  catch { diffAvailable = false; }
  writeRepoMap(root, safeProjectName(root), join(directory, 'generated'));
  compileDotdogLayers(root, safeProjectName(root));
  if (existsSync(join(root, 'specs')) || existsSync(join(root, 'projects'))) invoke(root, ['compile', '--specs-only']);
  const graph = normalizeGraph(JSON.parse(readFileSync(dagFile, 'utf8')));
  const before = new Map([...oldGraph.nodes, ...oldGraph.edges].map(item => [item.id, JSON.stringify(item)]));
  const after = new Map([...graph.nodes, ...graph.edges].map(item => [item.id, JSON.stringify(item)]));
  const result = {
    ok: true, diffAvailable, changed: !unchanged, inputHash: hash, nodes: graph.nodes.length, edges: graph.edges.length,
    added: [...after.keys()].filter(id => !before.has(id)).sort(),
    changedIds: [...after.keys()].filter(id => before.has(id) && before.get(id) !== after.get(id)).sort(),
    removed: [...before.keys()].filter(id => !after.has(id)).sort(),
  };
  const outputHashes = Object.fromEntries(listRepoFiles(root).filter(file => /\.dag$/.test(file)).map(file => [file, digest(readFileSync(join(root, file)))]));
  writeFileSync(stateFile, JSON.stringify({ ...result, outputHash: digest(readFileSync(dagFile)), outputHashes }, null, 2) + '\n');
  return result;
}

function installFile(root: string, path: string, content: string) {
  const absolute = join(root, path);
  resolveUserPath(absolute, root);
  mkdirSync(dirname(absolute), { recursive: true });
  if (existsSync(absolute)) {
    if (lstatSync(absolute).isSymbolicLink() || readFileSync(absolute, 'utf8') !== content) throw new Error(`Refusing to replace existing file: ${path}`);
    return;
  }
  writeFileSync(absolute, content, { mode: 0o755 });
}

export function registerAutomation(program: Command) {
  program.command('refresh').description('Refresh observed graphs and specs; report deterministic graph changes')
    .option('--if-stale', 'skip graph extraction when content hashes match')
    .option('--json', 'print JSON')
    .action(opts => {
      const result = refreshGraph(process.cwd(), opts.ifStale);
      const output = { ...result, changeCounts: { added: result.added.length, changed: result.changedIds.length, removed: result.removed.length }, added: result.added.slice(0, 100), changedIds: result.changedIds.slice(0, 100), removed: result.removed.slice(0, 100), truncated: [result.added, result.changedIds, result.removed].some(items => items.length > 100) };
      console.log(opts.json ? JSON.stringify(output, null, 2) : `${result.changed ? 'Refreshed' : 'Current'}: ${result.nodes} nodes, ${result.edges} edges; +${result.added.length} ~${result.changedIds.length} -${result.removed.length}`);
    });

  program.command('check').description('Rebuild and check graph integrity for CI or the Git index')
    .option('--staged', 'check a temporary snapshot of the Git index, not unstaged files')
    .option('--json', 'print JSON')
    .action(opts => {
      let snapshot: string | undefined;
      try {
        let root = process.cwd();
        if (opts.staged) {
          snapshot = mkdtempSync(join(tmpdir(), 'dotdog-index-'));
          execFileSync('git', ['checkout-index', '--all', `--prefix=${snapshot}/`], { cwd: root });
          root = snapshot;
        }
        if (existsSync(join(root, 'specs')) || existsSync(join(root, 'projects'))) invoke(root, ['validate']);
        const result = refreshGraph(root);
        if (!result.nodes) throw new Error('No graph nodes were produced');
        console.log(opts.json ? JSON.stringify({ ok: true, nodes: result.nodes, edges: result.edges, changed: result.changed }) : `Graph check passed: ${result.nodes} nodes, ${result.edges} edges`);
      } catch (error) {
        process.exitCode = 1;
        const message = error instanceof Error ? error.message : String(error);
        if (opts.json) console.log(JSON.stringify({ ok: false, error: message }));
        else console.error(message);
      } finally {
        if (snapshot) rmSync(snapshot, { recursive: true, force: true });
      }
    });

  const skills = program.command('skills').description('Install repository-scoped Codex and Claude skills');
  skills.command('install').option('--agent <agent>', 'codex, claude, or both', 'both').action(opts => {
    if (!['codex', 'claude', 'both'].includes(opts.agent)) throw new Error('Expected codex, claude, or both');
    const source = readFileSync(new URL('../skills/dotdog/SKILL.md', import.meta.url), 'utf8');
    for (const [agent, directory] of [['codex', '.agents'], ['claude', '.claude']]) {
      if (opts.agent !== 'both' && opts.agent !== agent) continue;
      const path = `${directory}/skills/dotdog/SKILL.md`;
      installFile(process.cwd(), path, source);
      console.log(`Installed ${path}`);
    }
  });

  const hooks = program.command('hooks').description('Opt-in, repository-local Git and Claude hooks');
  hooks.command('install').requiredOption('--agent <agent>', 'git or claude').action(opts => {
    const root = process.cwd();
    if (!['git', 'claude'].includes(opts.agent)) throw new Error('Expected git or claude');
    if (opts.agent === 'git') {
      let configured = '';
      try { configured = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (error: any) { if (error.status !== 1) throw error; }
      if (configured) throw new Error('core.hooksPath is configured; add dotdog check --staged to your existing hook manager');
    }
    const manifestDir = resolveUserPath('.doghouse/hooks', root);
    mkdirSync(manifestDir, { recursive: true });
    const manifest = join(manifestDir, opts.agent + '.json');
    if (existsSync(manifest)) { console.log('Hook already installed; use hooks status to inspect it.'); return; }
    if (opts.agent === 'git') {
      const path = execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], { cwd: root, encoding: 'utf8' }).trim();
      const target = join(root, path);
      const content = '#!/bin/sh\nexec dotdog check --staged\n';
      installFile(root, relative(root, target), content);
      writeFileSync(manifest, JSON.stringify({ path, sha256: digest(content) }));
    } else {
      const path = '.claude/settings.json', target = join(root, path);
      resolveUserPath(target, root);
      mkdirSync(dirname(target), { recursive: true });
      const settings = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
      const command = 'dotdog refresh --if-stale';
      const hook = { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command, timeout: 30 }] };
      settings.hooks ||= {};
      settings.hooks.PostToolUse ||= [];
      settings.hooks.PostToolUse.push(hook);
      writeFileSync(target, JSON.stringify(settings, null, 2) + '\n');
      writeFileSync(manifest, JSON.stringify({ path, hook }));
    }
    console.log(`Installed ${opts.agent} hook; inspect with dotdog hooks status, remove with dotdog hooks remove --agent ${opts.agent}`);
  });
  hooks.command('status').action(() => {
    for (const agent of ['git', 'claude']) {
      const root = process.cwd(), file = join(root, '.doghouse/hooks', agent + '.json');
      if (!existsSync(file)) { console.log(JSON.stringify({ agent, installed: false })); continue; }
      const owned = JSON.parse(readFileSync(file, 'utf8')), target = resolveUserPath(owned.path, root);
      let active = false;
      if (existsSync(target)) {
        active = agent === 'git' ? digest(readFileSync(target)) === owned.sha256 : (JSON.parse(readFileSync(target, 'utf8')).hooks?.PostToolUse || []).some((hook: any) => JSON.stringify(hook) === JSON.stringify(owned.hook));
      }
      console.log(JSON.stringify({ agent, installed: active, registered: true, path: owned.path, ...(active ? {} : { warning: 'Hook is missing or edited' }) }));
    }
  });
  hooks.command('remove').requiredOption('--agent <agent>', 'git or claude').action(opts => {
    if (!['git', 'claude'].includes(opts.agent)) throw new Error('Expected git or claude');
    const root = process.cwd(), manifest = join(root, '.doghouse/hooks', opts.agent + '.json');
    if (!existsSync(manifest)) return;
    const owned = JSON.parse(readFileSync(manifest, 'utf8')), target = resolveUserPath(owned.path, root);
    if (!existsSync(target)) { unlinkSync(manifest); console.log('Removed stale hook registration'); return; }
    if (opts.agent === 'git') {
      if (digest(readFileSync(target)) !== owned.sha256) throw new Error('Hook was edited; preserve it and remove the Dotdog line manually');
      unlinkSync(target);
    } else {
      const settings = JSON.parse(readFileSync(target, 'utf8'));
      if (!(settings.hooks?.PostToolUse || []).some((hook: any) => JSON.stringify(hook) === JSON.stringify(owned.hook))) throw new Error('Claude hook was edited; remove it manually without changing unrelated hooks');
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((hook: any) => JSON.stringify(hook) !== JSON.stringify(owned.hook));
      writeFileSync(target, JSON.stringify(settings, null, 2) + '\n');
    }
    unlinkSync(manifest);
    console.log(`Removed ${opts.agent} hook`);
  });
}
