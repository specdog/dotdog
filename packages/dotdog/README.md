# dotdog

[![npm version](https://img.shields.io/npm/v/dotdog)](https://www.npmjs.com/package/dotdog)
[![npm downloads](https://img.shields.io/npm/dm/dotdog)](https://www.npmjs.com/package/dotdog)
[![License: MIT](https://img.shields.io/npm/l/dotdog)](https://github.com/specdog/dotdog/blob/main/LICENSE)
[![CI](https://github.com/specdog/dotdog/actions/workflows/test.yml/badge.svg)](https://github.com/specdog/dotdog/actions)

> **Feed the dog. Ship with specs.** Write .dog specs. Dog checks them. AI agents fetch them.

## Install

```bash
npm install -g dotdog
```

Requires Node.js >= 20.

## Quick Start

```bash
dotdog init my-project     # scaffold a spec genome
dotdog validate            # score completeness (0-100%)
dotdog analyze             # deep analysis : gaps, suggestions, entity audit
```

## Commands

| Command | Description |
|---------|-------------|
| `dotdog validate [dir]` | Score spec completeness. Checks file existence, entity descriptions, section counts. |
| `dotdog analyze [dir]` | Deep analysis. Detects domain, stack, gaps with severity, entity quality audit. |
| `dotdog parse <file>` | Parse a `.dog` file into sections. |
| `dotdog compile [dir]` | Compile `.dog` files into a `.dag` graph (JSON). |
| `dotdog visualize [dir]` | Output Mermaid graph from `.dag`. `--save` writes `.md` for GitHub rendering. |
| `dotdog serve [dir]` | Start MCP server over stdio. AI agents query specs without hallucination. |
| `dotdog staleness [dir]` | Detect drift between spec and reality. Compares plan.dog tasks against code. |
| `dotdog generate [dir]` | Generate missing spec files from SPEC.dog (data-model, COPY, INDEX). |
| `dotdog simulate <scenario>` | Run a simulation scenario. Reads SPEC.dog scenarios, checks pre/postconditions. |
| `dotdog init <project>` | Scaffold a new spec genome project with templates. |
| `dotdog list` | List all projects and their `.dog` file counts. |

## File Formats

### `.dog` : Human-Written Spec Genome

Markdown prose + YAML structured blocks. Free and open source. Define entities, relationships, events, predictions, and copy in a single format that both humans and parsers understand.

```markdown
### Entity: User

A person who uses the app.

` ``yaml
entity: User
type: entity
properties:
  id:
    type: string
    required: true
  email:
    type: string
    required: true
states: [active, suspended]
lifecycle: active → suspended
` ``
```

### `.dag` : Machine-Compiled Graph

JSON graph compiled from `.dog` files. Nodes, edges, properties, and states in a deterministic structure. 85% token savings vs raw `.dog` files for AI agents.

## MCP Server : AI Agent Integration

`dotdog serve` exposes specs to any MCP-compatible AI agent over stdio. Six tools:

| Tool | Description |
|------|-------------|
| `getEntity` | Exact entity with properties, states, lifecycle, and connected edges |
| `traverse` | BFS subgraph from any starting node to any depth |
| `search` | Find entities by name or type |
| `schema` | Property definitions only : zero prose, agent-optimized |
| `summary` | Node count, edge count, file count, compile time |
| `listProjects` | Array of project names |

Agent workflow: `listProjects` → `getEntity` → `traverse` graph.

## Dogfood

dotdog validates its own specs. Every PR:

```
dotdog validate → find gaps → fix spec → PR → merge → tag → CI publish
```

Eat your own dogfood. The tool is the project.

## VS Code Extension

Syntax highlighting for `.dog` files. Install:

```bash
cp -r extensions/vscode ~/.vscode/extensions/dotdog
```

## Format Specifications

- [`.dog` format spec](spec/format-spec.dog) : language definition, EBNF grammar, validation rules
- [`.dag` format spec](spec/format-spec-dag.dog) : graph definition, MCP API, token efficiency

## Links

- **GitHub:** [specdog/dotdog](https://github.com/specdog/dotdog)
- **npm:** [dotdog](https://www.npmjs.com/package/dotdog)
- **Docs:** [GitHub Pages](https://specdog.github.io/dotdog)
- **llms.txt:** [llms.txt](llms.txt) : structured for AI agent discovery
- **AGENTS.md:** [AGENTS.md](AGENTS.md) : instructions for AI coding agents

## Spec-Driven Development

dotdog is built for SDD. Write your spec first. Validate it. Compile it. Let AI agents query it. The spec is the source of truth.

```
spec → validate → compile → serve → AI agent queries
```

No more specs that rot in a wiki. No more agents guessing from prose. One source. Zero ambiguity.

## License

MIT
