# dotdog

[![npm version](https://img.shields.io/npm/v/dotdog)](https://www.npmjs.com/package/dotdog)
[![npm downloads](https://img.shields.io/npm/dm/dotdog)](https://www.npmjs.com/package/dotdog)
[![spec savings](https://raw.githubusercontent.com/specdog/dotdog/main/dotdog-badge.svg)](https://github.com/specdog/dotdog)
[![License: MIT](https://img.shields.io/npm/l/dotdog)](https://github.com/specdog/dotdog/blob/main/LICENSE)
[![CI](https://github.com/specdog/dotdog/actions/workflows/test.yml/badge.svg)](https://github.com/specdog/dotdog/actions)
[![MCP Server](https://img.shields.io/badge/MCP-Server-6b4df0)](https://glama.ai/mcp/servers/specdog/dotdog)
[![Install in VS Code](https://img.shields.io/badge/Install_in_VS_Code-0098FF?logo=visualstudiocode)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522dotdog%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522dotdog%2540latest%2522%252C%2522serve%2522%255D%257D)
[![Install in Cursor](https://img.shields.io/badge/Install_in_Cursor-1a1a1a?logo=cursor)](https://cursor.com/install-mcp?name=dotdog&config=%7B%22command%22%3A%22npx%20-y%20dotdog%40latest%20serve%22%7D)

> **Spec-driven design for agent-ready projects and workspaces.** Turn plans, repos, or multi-repo products into structured `.dog` specs, compile `.dag` graphs, and let agents query real project structure instead of guessing.

## What dotdog does

dotdog is a spec-driven design toolchain for single repos, monorepos, and polyrepo workspaces.

It supports three starting points:

1. **Empty project** — create a spec foundation before implementation.
2. **Existing project** — map the current repo into structured graph facts.
3. **Workspace product** — describe a product made from N repositories with `.doghouse/workspace.json`.

The core flow:

```text
plan -> spec workspace -> validation -> repo/workspace graph -> agent execution
```

`.dog` files are the human-readable source specs. `.dag` files are compiled implementation graphs for agents and tools.

## Install

```bash
npm install -g dotdog    # npm
brew install dotdog       # Homebrew
bun add -g dotdog         # bun
```

Requires Node.js >= 20 or Bun >= 1.3.

## Quick Start

```bash
dotdog init my-project      # create a spec workspace
dotdog validate             # check spec completeness
dotdog compile              # build the .dag implementation graph
dotdog serve                # expose the graph to MCP-compatible agents
```

For an existing product or organization workspace:

```bash
dotdog workspace init --id example-workspace
dotdog workspace add ../example-service --alias example-service --role api
dotdog workspace add ../example-interface --alias example-interface --role web
dotdog workspace validate
dotdog workspace graph --json
```

## What init creates

`dotdog init <project>` creates a project spec workspace under `specs/<project>/`.

```text
specs/<project>/
  INDEX.dog
  SPEC.dog
  constitution.dog
  data-model.dog
  plan.dog
  COPY.dog
```

Planned full scaffold:

```text
specs/<project>/
  INDEX.dog
  SPEC.dog
  constitution.dog
  data-model.dog
  plan.dog
  COPY.dog
  tasks.dog
  tasks/
    AGENTS.dog
```

Edit order:

1. `SPEC.dog` — product intent, behavior, flows, and user stories.
2. `data-model.dog` — entities, states, schemas, and relationships.
3. `plan.dog` — implementation phases and tasks.
4. `constitution.dog` — constraints, rules, and boundaries.
5. `INDEX.dog` — navigation map for humans and agents.
6. `COPY.dog` — user-facing text and interface language.

Then run:

```bash
dotdog validate
dotdog compile
```

## Workspaces for N repos

A Dotdog workspace is a product boundary. It can contain one repo, a monorepo, or N separate repositories.

Workspace metadata lives in:

```text
.doghouse/workspace.json
```

Example:

```json
{
  "version": 1,
  "workspace": { "id": "example-workspace", "name": "example-workspace" },
  "repos": [
    { "alias": "example-service", "role": "api", "path": "../example-service" },
    { "alias": "example-interface", "role": "web", "path": "../example-interface" }
  ],
  "groups": [],
  "edges": []
}
```

The workspace graph emits repo-qualified facts so humans and agents can distinguish where a fact came from:

```text
example-service:src/routes/core-flow.ts
example-interface:src/features/core-flow/index.ts
```

No manifest is required for single-repo projects; Dotdog treats the current repo as a one-repo workspace by default.

Only `.doghouse/workspace.json` is intended for version control. Generated workspace graphs and observed facts are ignored by default because they may contain repository metadata. Workspace CLI and MCP responses use repository-relative paths; the legacy `cwd` key is a relative alias for `path`.

## Repo mapping direction

dotdog should not only scaffold empty projects. It should also map existing repos.

The intended graph connects product intent to real implementation:

```text
frontend component -> API route -> backend handler -> schema -> database table -> env var -> infra resource -> task/spec reason
```

Target node types include files, directories, packages, frontend components, routes, pages, API endpoints, backend handlers, services, schemas, database tables, migrations, environment variables, cloud resources, CI workflows, tests, tasks, and specs.

Target edge types include imports, calls, renders, reads, writes, depends_on, implements, configured_by, deployed_by, tested_by, documented_by, and owned_by.

See [Spec-Driven Repo Mapping](docs/spec-driven-repo-mapping.md) for the formal plan.

## Commands

| Command | Description |
|---------|-------------|
| `dotdog init <project>` | Create a spec workspace for a new project. |
| `dotdog validate [dir]` | Score spec completeness. Checks file existence, entity descriptions, section counts. |
| `dotdog compile [dir]` | Compile `.dog` files into a `.dag` graph for agents and tools. |
| `dotdog analyze [dir]` | Deep analysis. Detects domain, stack, gaps with severity, entity quality audit. |
| `dotdog badge [dir]` | Generate a shields.io SVG badge showing token savings. |
| `dotdog staleness [dir]` | Detect drift between spec and reality. Compares plan.dog tasks against code. |
| `dotdog tokens [dir]` | Count tokens in `.dog` files and compare to compiled `.dag` savings. |
| `dotdog index [dir]` | Build search index for semantic queries across compiled specs. |
| `dotdog search <query>` | Semantic search across compiled specs using the search index. |
| `dotdog serve [dir]` | Start MCP server over stdio. AI agents query specs and workspace metadata without hallucination. |
| `dotdog workspace init --id <id>` | Create `.doghouse/workspace.json` for a repo or product workspace. |
| `dotdog workspace add <path>` | Add a repository to the workspace manifest with `--alias` and `--role`. |
| `dotdog workspace list` | List workspace repos and groups. Use `--json` for structured output. |
| `dotdog workspace validate` | Validate workspace manifest aliases, paths, groups, and edges. |
| `dotdog workspace graph` | Emit deterministic workspace graph JSON. |
| `dotdog map [dir]` | Inspect an existing repo and generate graph-ready `.dog` facts plus `repo.dag`. |
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
| `dotdog live [entity]` | Test live endpoints + cloud infrastructure against .dog contracts. Hits URLs, diffs responses, backup failover. Verify S3 buckets, Vercel projects, Supabase tables, and more. |

Planned:

| Command | Description |
|---------|-------------|
| `dotdog init <project> --map` | Create a spec workspace and seed it from the current repo. |
| Cross-repo trace/search | Infer relationships across workspace repos beyond explicit manifest edges. |

## File Formats

### `.dog` : Human-Written Source Spec

Markdown prose + YAML structured blocks. Free and open source. Define entities, relationships, events, predictions, implementation facts, and copy in a single format that both humans and parsers understand.

```markdown
### Entity: User

A person who uses the app.

```yaml
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
lifecycle: active -> suspended
```
```

### `.dag` : Machine-Compiled Implementation Graph

JSON graph compiled from `.dog` files. Nodes, edges, properties, and states in a deterministic structure. Designed for AI agents to query exact project structure with lower token cost than raw prose.

Example graph facts:

```text
CoreFlowPage renders StatusPanel
CoreFlowPage calls POST /api/core-flow
POST /api/core-flow writes records
POST /api/core-flow depends_on SERVICE_TOKEN
records implemented_by prisma/schema.prisma
```

## MCP Server : AI Agent Integration

`dotdog serve` exposes specs to any MCP-compatible AI agent over stdio.

| Tool | Description |
|------|-------------|
| `getEntity` | Exact entity with properties, states, lifecycle, and connected edges |
| `traverse` | BFS subgraph from any starting node to any depth |
| `search` | Find entities by name or type |
| `schema` | Property definitions only : zero prose, agent-optimized |
| `summary` | Node count, edge count, file count, compile time |
| `listProjects` | Array of project names |
| `workspace.list` | Structured workspace metadata with repos, groups, and `trustedAsInstruction: false` |
| `infraVerify` | Read-only checks for declared infrastructure resources |

Agent workflow:

```text
workspace.list -> listProjects -> getEntity -> traverse graph
```

`dotdog serve` is a local stdio server. It does not open a TCP port or write query logs. If you place it behind a gateway, secure the gateway with authentication and least-privilege access.

## Dogfood

dotdog validates its own specs. Every PR:

```text
dotdog validate -> find gaps -> fix spec -> PR -> merge -> tag -> CI publish
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
- **[collar](https://github.com/specdog/collar)** — DAG-first agent harness.
- **[dogbench](https://github.com/specdog/dogbench)** — Token-savings benchmarks for Collar and dotdog.
- **[dogfood-paybot](https://github.com/specdog/dogfood-paybot)** — Dogfood test: dotdog on a real payment bot project.
- **[homebrew-dotdog](https://github.com/specdog/homebrew-dotdog)** — Homebrew tap for `brew install dotdog`.

## Links

- **GitHub:** [specdog/dotdog](https://github.com/specdog/dotdog)
- **npm:** [dotdog](https://www.npmjs.com/package/dotdog)
- **Docs:** [Tutorial](https://specdog.github.io/dotdog/tutorial) · [FAQ](https://specdog.github.io/dotdog/faq) · [Integrations](https://specdog.github.io/dotdog/integrations) · [Use Cases](https://specdog.github.io/dotdog/use-cases)
- **llms.txt:** [llms.txt](llms.txt) : structured for AI agent discovery
- **AGENTS.md:** [AGENTS.md](AGENTS.md) : instructions for AI coding agents

## Spec-Driven Development

dotdog is built for spec-driven development and spec-driven design. Write or map the spec first. Validate it. Compile it. Let agents query the implementation graph.

```text
plan -> spec -> validate -> compile -> serve -> agent queries
```

No more specs that rot in a wiki. No more agents guessing from prose. One source. Queryable graph.

## License

MIT
