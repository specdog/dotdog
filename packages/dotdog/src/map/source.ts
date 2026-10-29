import { posix } from 'path';
import type { RepoMapFact, RepoMapEdge } from './repoMapper';

export function mapSource(file: string, source: string, files: Set<string>) {
  const facts: RepoMapFact[] = [], edges: RepoMapEdge[] = [], limitations: string[] = [];
  const { parse } = require('@babel/parser') as typeof import('@babel/parser');
  let ast;
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'], errorRecovery: false });
  } catch (error) {
    return { facts, edges, limitations: [`${file}: AST parsing failed: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const from = `file:${file}`;
  const resolveImport = (specifier: string) => {
    if (!specifier.startsWith('.')) return null;
    const base = posix.normalize(posix.join(posix.dirname(file), specifier));
    const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'].map(ext => base + ext), ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + '/index' + ext)];
    if (/\.[mc]?js$/.test(base)) candidates.push(base.replace(/\.[mc]?js$/, '.ts'), base.replace(/\.[mc]?js$/, '.tsx'));
    return candidates.find(candidate => files.has(candidate)) || null;
  };
  for (const statement of ast.program.body) {
    const node: any = statement;
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && typeof node.source?.value === 'string') {
      const target = resolveImport(node.source.value);
      if (target) edges.push({ source: from, target: `file:${target}`, verb: node.type === 'ImportDeclaration' ? 'imports' : 'exports' });
      else if (node.source.value.startsWith('.')) limitations.push(`${file}:${node.loc?.start.line}: unresolved import ${node.source.value}`);
    }
    const declaration = node.declaration || node;
    let names: string[] = [];
    if (['FunctionDeclaration', 'ClassDeclaration', 'TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'].includes(declaration.type) && declaration.id?.name) names = [declaration.id.name];
    if (declaration.type === 'VariableDeclaration') names = declaration.declarations.filter((item: any) => item.id?.type === 'Identifier').map((item: any) => item.id.name);
    for (const name of names) {
      const symbol = `symbol:${file}#${name}`;
      facts.push({ name: symbol, type: 'symbol', description: `${declaration.type} ${name}`, properties: { path: file, line: String(declaration.loc?.start.line || 1), name } });
      edges.push({ source: from, target: symbol, verb: 'defines' });
      if (node.type.startsWith('Export')) edges.push({ source: from, target: symbol, verb: 'exports' });
    }
  }
  return { facts, edges, limitations };
}
