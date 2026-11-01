import { createRequire } from 'module';
import { createHash } from 'crypto';
import { readFileSync, readSync, statSync } from 'fs';
import { basename, dirname, isAbsolute, relative, sep } from 'path';
import { pathToFileURL } from 'url';
import { parseExpression } from '@babel/parser';
import { normalizeGraph } from '../graph/model';
import { isIgnoredRepoPath, realPath, resolveUserPath } from '../workspace/paths';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fail = (error: string, diagnostics: unknown[] = []) => ({ ok: false, error, diagnostics });

async function inspect(request: any) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (process.versions.bun || major < 22 || major === 22 && minor < 12) return fail('compiler_runtime_unsupported');
  const root = realPath(request.root), { name } = request;
  const config = resolveUserPath(request.project, root), file = resolveUserPath(request.file, root);
  const require = createRequire(config);
  let packageFile: string;
  try { packageFile = require.resolve('typescript/package.json'); } catch { return fail('compiler_missing'); }
  if (JSON.parse(readFileSync(packageFile, 'utf8')).version !== '7.0.2') return fail('compiler_version_unsupported');
  const compilerRoot = realPath(dirname(packageFile));
  const apiModule = await import(pathToFileURL(require.resolve('typescript/unstable/sync')).href);
  const ast = await import(pathToFileURL(require.resolve('typescript/unstable/ast')).href);
  const portable = (path: string) => relative(root, path).split(sep).join('/');
  const inside = (path: string) => { const value = relative(root, path); return value !== '..' && !value.startsWith('..' + sep) && !isAbsolute(value); };
  const inputs = new Map<string, { text: string; sha256: string }>();
  let size = 0, inputError = '';
  const read = (path: string): string | null => {
    try {
      path = realPath(path);
      if (inputs.has(path)) return inputs.get(path)!.text;
      const library = path === compilerRoot || path.startsWith(compilerRoot + sep) || path.split(sep).includes('node_modules');
      if ((!inside(path) && !library) || inside(path) && !library && isIgnoredRepoPath(portable(path)) || isIgnoredRepoPath(basename(path)) || !/\.(?:[cm]?tsx?|[cm]?jsx?|json)$/i.test(path)) { inputError = 'compiler_input_unsupported'; return null; }
      const stat = statSync(path);
      if (!stat.isFile() || inputs.size >= 512 || size + stat.size > 32 * 1024 * 1024) { inputError = 'compiler_input_limit'; return null; }
      const bytes = readFileSync(path);
      if (bytes.length !== stat.size || bytes[0] === 0xff || bytes[0] === 0xfe) { inputError = 'compiler_input_unsupported'; return null; }
      size += bytes.length;
      const text = bytes.toString('utf8'); inputs.set(path, { text, sha256: digest(bytes) }); return text;
    } catch { return null; }
  };
  const configText = read(config);
  if (configText === null) return fail(inputError || 'invalid_config');
  const configAst: any = parseExpression(configText);
  if (configAst.type !== 'ObjectExpression' || configAst.properties.some((item: any) => (item.key?.value ?? item.key?.name) === 'references' && !(item.value?.type === 'ArrayExpression' && item.value.elements.length === 0))) return fail('project_references_unsupported');
  let api: any, snapshot: any;
  try {
    api = new apiModule.API({ cwd: root, fs: { readFile: read } });
    snapshot = api.updateSnapshot({ openProjects: [config] });
    const project = snapshot.getProject(config);
    if (!project || snapshot.getProjects().length !== 1) return fail('project_unsupported');
    const program = project.program, checker = project.checker, options = program.getCompilerOptions();
    if (options.noCheck || options.composite) return fail('compiler_config_unsupported');
    const errors = [...program.getConfigFileParsingDiagnostics(), ...program.getProgramDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()].filter(item => item.category === apiModule.DiagnosticCategory.Error);
    if (inputError) return fail(inputError);
    const diagnostics = errors.slice(0, 100).map(item => ({ code: item.code }));
    if (errors.length) return fail('typecheck_failed', diagnostics);
    const source = program.getSourceFile(file);
    if (!source) return fail('file_not_in_project');
    const module = checker.getSymbolAtLocation(source);
    const selected = module && checker.getExportsOfModule(module).find((symbol: any) => symbol.name === name);
    if (!selected) return fail('export_not_found');
    const nodes = new Map<string, any>(), edges = new Map<string, any>(), symbols = new Map<number, string>();
    const limitations = new Set(['Selected declared type references only; not full semantic dependency closure, runtime impact or requirement proof.', 'Saved audits check recorded repository inputs, not new or unloaded files; re-inspect after project, compiler or dependency changes.']);
    const queue: any[] = [];
    let signatureBytes = 0, visits = 0;
    const add = (candidate: any): string | undefined => {
      const symbol = candidate.flags & apiModule.SymbolFlags.Alias ? checker.getAliasedSymbol(candidate) : candidate;
      if (symbols.has(symbol.id)) return symbols.get(symbol.id);
      if (symbol.flags & apiModule.SymbolFlags.TypeParameter) return;
      if (symbols.size >= 64) { limitations.add('Contract limit reached.'); return; }
      const handles = symbol.declarations;
      const handle = handles.find((item: any) => { try { return !isIgnoredRepoPath(portable(resolveUserPath(item.path, root))); } catch { return false; } });
      if (!handle) { limitations.add(`External or unresolved contract omitted: ${symbol.name}`); return; }
      const declaration = handle.resolve(project);
      if (!declaration) { limitations.add(`Unresolved declaration: ${symbol.name}`); return; }
      const path = resolveUserPath(handle.path, root), location = declaration.getStart(), sourceFile = portable(path);
      const type = symbol.flags & (apiModule.SymbolFlags.TypeAlias | apiModule.SymbolFlags.Interface | apiModule.SymbolFlags.Class) ? checker.getDeclaredTypeOfSymbol(symbol) : checker.getTypeOfSymbol(symbol);
      if (!type || type.isErrorType?.()) { limitations.add(`Unresolved contract: ${symbol.name}`); return; }
      const signature = checker.typeToString(type, declaration, apiModule.NodeBuilderFlags.NoTruncation | apiModule.NodeBuilderFlags.InTypeAlias);
      const bytes = Buffer.byteLength(signature);
      if (signatureBytes + bytes > 65536) { limitations.add('Signature byte limit reached.'); return; }
      signatureBytes += bytes;
      const id = `type:${sourceFile}#${symbol.name}@${location}`;
      symbols.set(symbol.id, id);
      nodes.set(id, { id, label: `${sourceFile}#${symbol.name}`, kind: symbol.flags & apiModule.SymbolFlags.Function ? 'function' : 'type', source: sourceFile, properties: { name: symbol.name, signature }, origin: { type: 'observed', provider: 'typescript', file: sourceFile, line: declaration.getSourceFile().getLineAndCharacterOfPosition(location).line + 1, digest: inputs.get(path)?.sha256 } });
      queue.push({ symbol, id }); return id;
    };
    const edge = (from: string, to: string, verb: string) => edges.set(`${from}:${verb}:${to}`, { sourceId: from, targetId: to, verb });
    const selectedId = add(selected);
    if (!selectedId) return fail('selected_contract_unsupported');
    for (let index = 0; index < queue.length; index++) {
      const { symbol, id } = queue[index];
      const visit = (node: any, depth = 0) => {
        if (++visits > 10000 || depth > 128) { limitations.add('Declaration traversal limit reached.'); return; }
        if (node.kind === ast.SyntaxKind.Block) return;
        const target = node.kind === ast.SyntaxKind.TypeReference ? node.typeName : node.kind === ast.SyntaxKind.TypeQuery ? node.exprName : node.kind === ast.SyntaxKind.ExpressionWithTypeArguments ? node.expression : node.kind === ast.SyntaxKind.ComputedPropertyName ? node.expression : undefined;
        if (target) { const dependency = checker.getSymbolAtLocation(target); const next = dependency && add(dependency); if (next) edge(id, next, 'references_type'); }
        node.forEachChild((child: any) => { visit(child, depth + 1); });
      };
      for (const handle of symbol.declarations) { const declaration = handle.resolve(project); if (declaration) visit(declaration); }
    }
    if (inputError) return fail(inputError);
    const observedAt = new Date().toISOString(), inputHash = createHash('sha256');
    for (const [path, input] of [...inputs].sort(([a], [b]) => a.localeCompare(b))) {
      const stat = statSync(path);
      if (stat.size > 32 * 1024 * 1024 || digest(readFileSync(path)) !== input.sha256) return fail('inputs_changed');
      inputHash.update(inside(path) ? portable(path) : basename(path)).update('\0').update(input.sha256);
      if (inside(path) && !isIgnoredRepoPath(portable(path))) {
        const id = `type-input:${portable(path)}`;
        nodes.set(id, { id, label: portable(path), kind: 'evidence', properties: { file: portable(path), sha256: input.sha256, result: 'pass', observedAt }, description: 'Compiler input identity, not independent behavioral verification.' });
        edge(selectedId, id, 'checked_input');
      }
    }
    const compilerInfo = { name: 'typescript', version: '7.0.2', interface: 'unstable/sync' };
    const checking = Object.fromEntries(['strict', 'strictNullChecks', 'exactOptionalPropertyTypes', 'noUncheckedIndexedAccess', 'skipLibCheck'].filter(key => options[key] !== undefined).map(key => [key, options[key]]));
    const configInfo = { file: portable(config), sha256: inputs.get(config)?.sha256, checking, omittedOptions: 'Use the installed compiler defaults.' };
    const inputSha256 = inputHash.digest('hex');
    for (const { id } of queue) nodes.get(id).evidence = { compiler: compilerInfo, config: configInfo, inputSha256 };
    return {
      ...normalizeGraph({ project: 'types', nodes: [...nodes.values()], edges: [...edges.values()], coverage: { status: 'partial', scope: 'selected project type declarations' }, limitations: [...limitations] }),
      ok: true, selectedId, compiler: compilerInfo, config: configInfo, inputSha256, diagnostics: [],
    };
  } finally { try { snapshot?.dispose(); } finally { api?.close(); } }
}

try {
  const chunks: Buffer[] = [], buffer = Buffer.alloc(8192);
  let size = 0, length: number;
  while ((length = readSync(0, buffer, 0, buffer.length, null))) { size += length; if (size > 65536) throw new Error('Input limit'); chunks.push(Buffer.from(buffer.subarray(0, length))); }
  const result = await inspect(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
} catch { console.log(JSON.stringify(fail('compiler_failed'))); process.exitCode = 1; }
