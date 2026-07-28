---
layout: default
title: "dotdog — CLI and MCP tooling | specdog"
description: "dotdog CLI and MCP tooling for .dog specs, .dag graphs, repo mapping, and multi-repo workspaces."
---


# dotdog


> CLI and MCP tooling for structured `.dog` specs, compiled `.dag` graphs, repo mapping, and multi-repo workspaces.

AI agents are everywhere now — in your editor, your terminal, your CI pipeline. They know every framework and every API. But they do not know *your* project. They hallucinate entity names, invent relationships, and miss required fields because they are reading prose and guessing.

dotdog fixes this. You write your spec in readable `.dog` files — entities, properties, states, lifecycles, relationships. dotdog compiles them into a `.dag` graph that is 94% smaller than the source. The agent loads the graph instead of scanning 600 lines of prose. It queries exact data instead of interpreting English. Hallucination drops to near zero.

## Install

```bash
npm install -g dotdog    # npm
brew install dotdog       # Homebrew
bun add -g dotdog         # bun
```

Requires Node.js >= 20 or Bun >= 1.3.

Rust prerelease contributors can install from a repository checkout:

```bash
cargo install --path crates/dotdog
```

## See it work

```
$ dotdog init my-project
  Created 5 .dog files in projects/my-project/

$ dotdog validate
  my-project : 5 .dog files, 95% complete

$ dotdog compile
  ✓ my-project.dag
    5 nodes, 3 edges
    4620 → 280 tokens (93.9% savings)

$ dotdog serve
  MCP server ready — 6 tools available
```

The DAG is 94% smaller than source. Agents load the full entity graph in one shot instead of scanning prose. The DAG does not replace reading; it replaces scanning.

## How it works

You write specs before code. Five minutes to set up. Zero configuration.

| Step | Command | What happens |
|------|---------|-------------|
| Scaffold | `dotdog init` | Creates SPEC.dog, data-model.dog, and supporting files |
| Describe | edit `.dog` files | Define entities, properties, states, lifecycles, relationships |
| Validate | `dotdog validate` | Score completeness. Find missing entities and broken links |
| Compile | `dotdog compile` | Build a positional DAG graph — 94% smaller, optimized for LLM context |
| Design | `dotdog design` | Find missing data-model decisions and concrete next steps |
| Expose | `dotdog serve` | Start a local stdio MCP server. AI agents query via nine structured tools |

## Start with your situation

The terminal guides and interactive HTML map are part of the Rust prerelease while the npm package remains the stable distribution.

```bash
dotdog guide greenfield  # start a new product with intent before code
dotdog guide existing    # map an existing GitHub repo before changing it
dotdog guide speckit     # import GitHub Spec Kit artifacts
```

After compiling any graph, make it visible to people:

```bash
dotdog visualize path/to/project.dag --format html --save
```

The generated HTML is self-contained. Search nodes, drag to pan, scroll to zoom, and click a node to trace its direct connections.

Read [the exact greenfield, existing repository, Spec Kit, and multi-repo workflows](workflows).

## Observed workspace graph

Dotdog can also observe an existing repo or multi-repo workspace and write deterministic graph artifacts:

```bash
dotdog observe
dotdog ask "which files define routes?"
dotdog drift
```

`observe` writes `.doghouse/observed.json`, `.doghouse/facts.jsonl`, and `.doghouse/workspace.dag`. `ask` queries those facts without an LLM dependency. `drift` reports stale or missing observed references.

Generated `.doghouse` graphs and observed facts are ignored by Git by default because they may contain repository metadata. Workspace output uses repository-relative paths.

Read more: [Observed Workspace Graphs](blog/observed-workspace-graphs).

## For AI agents

Nine MCP tools for structured queries — no scanning, no guessing:

`getEntity` · `traverse` · `search` · `path` · `schema` · `summary` · `listProjects` · `workspace.list` · `infraVerify`

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

The bundled server uses stdio, opens no TCP listener, and writes no query logs. Secure any external gateway separately.

AI agents: read the [for agents · dogfood](https://specdog.github.io/agents) page before working with dotdog projects.

## Learn more

- [Spec-Driven Development guide](https://specdog.github.io/handbook) — the methodology behind the tool
- [Tutorial: Build a spec-driven project](tutorial)
- [Workflows: new, existing, Spec Kit, and multi-repo](workflows)
- [Contributing Kits](contributing-kits)
- [FAQ](faq)

---

dotdog@<span id="version">0.9.0</span> · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE) · [GitHub](https://github.com/specdog/dotdog) · [npm](https://www.npmjs.com/package/dotdog)
