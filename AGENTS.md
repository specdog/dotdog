# AGENTS.md : Instructions for AI coding agents

## What is dotdog?

dotdog is a CLI tool and file format for structured software specifications. It compiles `.dog` files (human-written markdown + YAML) into `.dag` graphs (machine-readable JSON) that AI agents can query without hallucination.

## How to use dotdog in this repo

### Validate
```
dotdog validate
```
Checks all .dog files for completeness. Reports score and gaps.

### Analyze
```
dotdog analyze [dir]
```
Deep analysis : identifies domain, stack, and gaps with severity. Scores entity quality (descriptions, properties, states). Lists all entities and relationships per file.

### Parse
```
dotdog parse <file.dog>
```
Shows every section and entity in a .dog file.

### Generate
```
dotdog generate [dir]
```
Reads SPEC.dog and generates missing files (data-model, COPY, INDEX). Never overwrites existing files.

### Compile
```
dotdog compile [dir]
```
Compiles .dog files into .dag graph. Outputs nodes, edges, file count.

### Visualize
```
dotdog visualize [dir]
```
Outputs Mermaid graph from .dag. Use `--save` to write a .md file for GitHub rendering.

### Serve (MCP)
```
dotdog serve
```
Starts MCP server over stdio. AI agents can query specs:
- getEntity(name) : exact types, states, properties
- traverse(from, depth) : BFS subgraph
- schema(entity) : property definitions only
- search(q, type) : find entities by name or type
- summary() : node/edge/file counts
- listProjects() : array of project names

### Simulate
```
dotdog simulate <scenario>
```
Runs a simulation scenario. Reads SPEC.dog scenarios, walks through steps, checks pre/postconditions. Phase 1 stub : full engine in future release.

### Staleness
```
dotdog staleness [dir]
```
Detects drift between spec files and reality. Compares plan.dog tasks against code (only audits Phases 1-3).

## File structure

```
projects/<name>/specs/  : Project specs (SPEC.dog, data-model.dog, etc.)
spec/                   : Format specifications
extensions/vscode/       : VS Code extension
packages/dotdog/         : CLI source
templates/               : Project templates
```

## Key rules

1. Run `dotdog validate` before committing changes to spec files
2. Score must not decrease
3. Format changes require updating spec/format-spec.dog
4. Use conventional commits (feat:, fix:, docs:, chore:)
5. Never commit dist/ : it's a build artifact
6. Run `dotdog analyze` after major spec changes to catch entity quality gaps
