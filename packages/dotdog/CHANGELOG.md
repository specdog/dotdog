# Changelog

## 0.3.1

- Fix npm packaging: homepage, bugs, engines, repository fields
- Trim keywords to 8 specific terms
- Ship correct README, LICENSE, and CHANGELOG in package
- CLI help text uses colons, no em dashes

## 0.3.0

- `dotdog analyze` — deep project analysis: score, gaps, entity audit
- `dotdog generate` — generate missing spec files from SPEC.dog
- `dotdog simulate` — run simulation scenarios
- `.dag` v1.2: provable token savings, typed nodes and edges
- VS Code extension: syntax highlighting for .dog files
- GitHub Pages and llms.txt for AI agent discoverability
- `dotdog serve` MCP server: getEntity, traverse, search, schema, summary
- Path traversal guard, traverse depth cap, serve hardening

## 0.2.0

- `dotdog compile` — compile .dog files to .dag graph
- `dotdog visualize` — Mermaid graph output with --save flag
- MCP server: expose .dag graph to AI agents over stdio
- `dotdog staleness` — detect drift between spec and reality
- `dotdog init` — scaffold new spec genome projects
- `dotdog list` — list all projects and .dog file counts

## 0.1.0

- `.dog` file format v1.0
- `.dag` file format v1.0
- `dotdog validate` — validate spec completeness
- `dotdog parse` — parse .dog files
