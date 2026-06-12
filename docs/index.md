# dotdog

> **Feed the dog. Ship with specs.** — Structured, AI-queryable software specifications.

## Install

```bash
npm install -g dotdog
```

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks.

```
$ dotdog init my-app
$ dotdog validate

  my-app — 7 .dog files, 100% complete

$ dotdog analyze

  my-app — 7 files | 100% complete
    SPEC.dog — 5 sections, 1.0KB
    data-model.dog — 3 sections, 1.6KB (5 entities, 6 rels)
  No gaps found.

$ dotdog compile
  ✓ my-app.dag — 3 nodes, 3 edges

$ dotdog serve
  MCP server running — AI agents query your specs with zero hallucination
```

## Commands

| Command | Description |
|---------|-------------|
| `dotdog validate` | Score spec completeness (0-100%) |
| `dotdog analyze` | Deep analysis — gaps, entity quality, suggestions |
| `dotdog parse` | Parse a .dog file into sections |
| `dotdog compile` | Compile .dog to .dag graph (JSON) |
| `dotdog generate` | Generate missing spec files from SPEC.dog |
| `dotdog serve` | MCP server for AI agents over stdio |
| `dotdog staleness` | Detect drift between spec and reality |
| `dotdog visualize` | Output Mermaid graph from .dag |
| `dotdog simulate` | Run a simulation scenario |
| `dotdog init` | Scaffold a new project |
| `dotdog list` | List all projects |

## Format

- `.dog` — Human-written spec (markdown + YAML entities). Free forever.
- `.dag` — Machine-compiled graph (JSON). Token-efficient for AI agents. 85% savings.

## For AI Agents

`dotdog serve` exposes your specs via MCP. Six tools:

| Tool | Description |
|------|-------------|
| `getEntity` | Exact entity with properties, states, edges |
| `traverse` | BFS subgraph from any node |
| `search` | Find entities by name or type |
| `schema` | Property definitions only — agent-optimized |
| `summary` | Node/edge/file counts |
| `listProjects` | All project names |

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec (.dog)](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
- [Format Spec (.dag)](https://github.com/specdog/dotdog/blob/main/spec/format-spec-dag.dog)
- [AGENTS.md](https://github.com/specdog/dotdog/blob/main/AGENTS.md)
- [llms.txt](https://github.com/specdog/dotdog/blob/main/llms.txt)
