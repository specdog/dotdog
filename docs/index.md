# 🐕 dotdog

> **Feed the dog. Ship with specs.** — Structured, AI-queryable software specifications for humans and AI agents.

## Install

```bash
npm install -g dotdog
```

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks. Compiles your specs into a queryable graph that AI agents can traverse with zero hallucination.

```
$ dotdog init my-app
$ dotdog validate
  my-app — 7 .dog files, 100% complete

$ dotdog analyze
  my-app — 7 files | 100% complete
    5 entities, 6 relationships
  No gaps found.

$ dotdog compile
  ✓ my-app.dag — 3 nodes, 3 edges
  12,400 → 1,860 tokens (85% savings)

$ dotdog serve
  MCP server running — AI agents query your specs
```

## Commands

| Command | Description |
|---------|-------------|
| `dotdog validate` | Score spec completeness (0-100%) |
| `dotdog analyze` | Deep analysis — gaps, entities, suggestions |
| `dotdog parse` | Parse a .dog file into sections |
| `dotdog compile` | Compile .dog to .dag with integrity hash + token savings |
| `dotdog generate` | Generate missing spec files from SPEC.dog |
| `dotdog serve` | MCP server — AI agents query specs over stdio |
| `dotdog staleness` | Detect drift between spec and reality |
| `dotdog visualize` | Output Mermaid graph from .dag |
| `dotdog simulate` | Run a simulation scenario |
| `dotdog init` | Scaffold a new spec genome project |
| `dotdog list` | List all projects |

## File Formats

### `.dog` — Human-Written Spec Genome

Markdown prose + YAML structured blocks. Define entities, relationships, events, and copy. Free forever.

### `.dag` — Machine-Compiled Graph

JSON graph with typed nodes, edges, integrity hash, and provable token savings. Built for AI agents — query via MCP with zero hallucination. Each `.dag` file proves exactly how much compute it saves vs reading raw specs.

## For AI Agents

`dotdog serve` exposes your specs via MCP. Six tools:

| Tool | Description |
|------|-------------|
| `getEntity` | Exact entity with properties, states, edges |
| `traverse` | BFS subgraph from any starting node |
| `search` | Find entities by name or type |
| `schema` | Property definitions only — zero prose |
| `summary` | Node/edge/file counts + token savings |
| `listProjects` | All project names |

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec (.dog)](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
- [Format Spec (.dag)](https://github.com/specdog/dotdog/blob/main/spec/format-spec-dag.dog)
- [AGENTS.md](https://github.com/specdog/dotdog/blob/main/AGENTS.md)
- [llms.txt](https://github.com/specdog/dotdog/blob/main/llms.txt)
