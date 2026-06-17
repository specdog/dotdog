---
layout: default
title: "dotdog — Spec-driven development CLI"
description: "Write structured specs. Validate completeness. Compile to graphs. AI agents query via MCP. No hallucination."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)

# dotdog

> The CLI tool that gives AI coding agents a brain.

AI agents are everywhere now — in your editor, your terminal, your CI pipeline. They know every framework and every API. But they do not know *your* project. They hallucinate entity names, invent relationships, and miss required fields because they are reading prose and guessing.

dotdog fixes this. You write your spec in readable `.dog` files — entities, properties, states, lifecycles, relationships. dotdog compiles them into a `.dag` graph that is 94% smaller than the source. The agent loads the graph instead of scanning 600 lines of prose. It queries exact data instead of interpreting English. Hallucination drops to near zero.

## Install

```
npm install -g dotdog
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
| Expose | `dotdog serve` | Start an MCP server. AI agents query via six structured tools |

## For AI agents

Six MCP tools for structured queries — no scanning, no guessing:

`getEntity` · `traverse` · `search` · `schema` · `summary` · `listProjects`

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

AI agents: read the [for agents](https://specdog.github.io/agents) page before working with dotdog projects.

## Learn more

- [Spec-Driven Development guide](https://specdog.github.io/handbook) — the methodology behind the tool
- [Tutorial: Build a spec-driven project](tutorial)
- [FAQ](faq)

---

dotdog@<span id="version">0.5.2</span> · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE) · [GitHub](https://github.com/specdog/dotdog) · [npm](https://www.npmjs.com/package/dotdog)
