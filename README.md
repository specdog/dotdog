# dotdog

[![npm version](https://img.shields.io/npm/v/dotdog)](https://www.npmjs.com/package/dotdog)
[![npm downloads](https://img.shields.io/npm/dm/dotdog)](https://www.npmjs.com/package/dotdog)
[![spec savings](https://raw.githubusercontent.com/specdog/dotdog/main/dotdog-badge.svg)](https://github.com/specdog/dotdog)
[![License: MIT](https://img.shields.io/npm/l/dotdog)](https://github.com/specdog/dotdog/blob/main/LICENSE)
[![CI](https://github.com/specdog/dotdog/actions/workflows/test.yml/badge.svg)](https://github.com/specdog/dotdog/actions)
[![MCP Server](https://img.shields.io/badge/MCP-Server-6b4df0)](https://glama.ai/mcp/servers/specdog/dotdog)
[![Install in VS Code](https://img.shields.io/badge/Install_in_VS_Code-0098FF?logo=visualstudiocode)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522dotdog%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522dotdog%2540latest%2522%252C%2522serve%2522%255D%257D)
[![Install in Cursor](https://img.shields.io/badge/Install_in_Cursor-1a1a1a?logo=cursor)](https://cursor.com/install-mcp?name=dotdog&config=%7B%22command%22%3A%22npx%20-y%20dotdog%40latest%20serve%22%7D)

<img width="700" alt="dotdog demo" src="https://vhs.charm.sh/vhs-3g4uEdsixykLRHyiWTVZFJ.gif">

> **Feed the dog. Ship with specs.** Write .dog specs. Dog checks them. AI agents fetch them.

## Install

```bash
npm install -g dotdog    # npm
brew install dotdog       # Homebrew
bun add -g dotdog         # bun
```

Requires Node.js >= 20 or Bun >= 1.3.

## Quick Start

```bash
dotdog init my-project     # scaffold a spec genome
dotdog validate            # score completeness (0-100%)
dotdog compile             # build the .dag graph (94% smaller)
dotdog badge               # generate savings badge for your README
```

## Commands

| Command | Description |
|---------|-------------|
| `dotdog init <project>` | Scaffold a new spec genome project with templates. |
| `dotdog validate [dir]` | Score spec completeness. Checks file existence, entity descriptions, section counts. |
| `dotdog compile [dir]` | Compile `.dog` files into a `.dag` graph (JSON). 94% smaller than source. |
| `dotdog analyze [dir]` | Deep analysis. Detects domain, stack, gaps with severity, entity quality audit. |
| `dotdog badge [dir]` | Generate a shields.io SVG badge showing token savings. |
| `dotdog staleness [dir]` | Detect drift between spec and reality. Compares plan.dog tasks against code. |
| `dotdog tokens [dir]` | Count tokens in `.dog` files and compare to compiled `.dag` savings. |
| `dotdog index [dir]` | Build search index for semantic queries across compiled specs. |
| `dotdog search <query>` | Semantic search across compiled specs using the search index. |
| `dotdog serve [dir]` | Start MCP server over stdio. AI agents query specs without hallucination. |
| `dotdog simulate <scenario>` | Walk through a scenario. Reads SPEC.dog scenarios, checks pre/postconditions. |
| `dotdog predictions [dir]` | List all predictions with status (pending, correct, wrong, partial). |
| `dotdog resolve <name>` | Mark a prediction as correct, wrong, or partial with evidence. |
| `dotdog doctor` | Baseline health check. Validates specs, detects stale .dag. |
| `dotdog visualize [dir]` | Output Mermaid graph from `.dag`. `--save` writes `.md` for GitHub rendering. |
| `dotdog generate [dir]` | Generate missing spec files from SPEC.dog (data-model, COPY, INDEX). |
| `dotdog parse <file>` | Parse a `.dog` file into sections (entities, relationships, copy). |
| `dotdog kit` | List, init, or manage spec kits (starter templates). |
| `dotdog list` | List all projects and their `.dog` file counts. |
| `dotdog woof` | Prints "woof" because every good CLI deserves an easter egg. |

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

JSON graph compiled from `.dog` files. Nodes, edges, properties, and states in a deterministic structure. 94% token savings vs raw `.dog` files for AI agents.

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

## Related Projects

- **[dotdefi](https://github.com/specdog/dotdefi)** — Spec-first DeFi development. Write .dog specs, generate Solidity stubs.
- **[dogfood-paybot](https://github.com/specdog/dogfood-paybot)** — Dogfood test: dotdog on a real payment bot project.
- **[homebrew-dotdog](https://github.com/specdog/homebrew-dotdog)** — Homebrew tap for `brew install dotdog`.

## Links

- **GitHub:** [specdog/dotdog](https://github.com/specdog/dotdog)
- **npm:** [dotdog](https://www.npmjs.com/package/dotdog)
- **Docs:** [Tutorial](https://specdog.github.io/dotdog/tutorial) · [FAQ](https://specdog.github.io/dotdog/faq) · [Integrations](https://specdog.github.io/dotdog/integrations) · [Use Cases](https://specdog.github.io/dotdog/use-cases)
- **llms.txt:** [llms.txt](llms.txt) : structured for AI agent discovery
- **AGENTS.md:** [AGENTS.md](AGENTS.md) : instructions for AI coding agents

## Spec-Driven Development

Read the **[SDD Handbook](https://specdog.github.io/dotdog/handbook)** — the complete guide to spec-driven development.

dotdog is built for SDD. Write your spec first. Validate it. Compile it. Let AI agents query it. The spec is the source of truth.

```
spec → validate → compile → serve → AI agent queries
```

No more specs that rot in a wiki. No more agents guessing from prose. One source. Zero ambiguity.

## License

MIT
