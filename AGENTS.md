# AGENTS.md — Instructions for AI coding agents

## What is dotdog?

dotdog is a CLI tool and file format for structured software specifications. It compiles `.dog` files (human-written markdown + YAML) into `.dag` graphs (machine-readable JSON) that AI agents can query without hallucination.

## How to use dotdog in this repo

### Validate
```
dotdog validate
```
Checks all .dog files for completeness. Reports score and gaps.

### Parse
```
dotdog parse <file.dog>
```
Shows every section and entity in a .dog file.

### Generate
```
dotdog generate [dir]
```
Reads SPEC.dog and generates missing files (data-model, COPY, constitution).

### Compile
```
dotdog compile [dir]
```
Compiles .dog files into .dag graph.

### Serve (MCP)
```
dotdog serve
```
Starts MCP server over stdio. AI agents can query specs:
- getEntity(name) — exact types, states, properties
- traverse(from, depth) — BFS subgraph
- schema(entity) — property definitions only

### Staleness
```
dotdog staleness [dir]
```
Detects drift between spec files and reality.

## File structure

```
projects/<name>/specs/  — Project specs (SPEC.dog, data-model.dog, etc.)
spec/                   — Format specifications
extensions/vscode/       — VS Code extension
packages/dotdog/         — CLI source
templates/               — Project templates
```

## Key rules

1. Run `dotdog validate` before committing changes to spec files
2. Score must not decrease
3. Format changes require updating spec/format-spec.dog
4. Use conventional commits (feat:, fix:, docs:, chore:)
