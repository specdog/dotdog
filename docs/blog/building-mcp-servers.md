---
layout: default
title: "Building MCP Servers That Actually Work"
date: 2026-06-17
author: Justin Diclemente
description: "MCP servers are the bridge between AI agents and your code. Here's how to build one that doesn't fall over."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Building MCP Servers That Actually Work

The Model Context Protocol (MCP) is the standard for AI agent tooling. MCP servers expose your codebase, database, APIs, and specs to any compatible agent. Claude, Copilot, Cursor — they all speak MCP.

Building an MCP server is easy. Building one that agents actually use correctly is harder. Here's what works.

## Six tools is the sweet spot

More than 10 tools and agents get confused. Less than 3 and they're underpowered. Six tools hits the balance:

| Tool | What it does | Why agents use it |
|------|-------------|-------------------|
| `getEntity` | Return one entity with properties | Grounds the agent on a single concept |
| `traverse` | Follow edges out to N hops | Builds the subgraph the agent needs |
| `search` | Find entities by name or type | Navigates large specs without scanning |
| `schema` | Return full property definitions | Knows required fields, types, constraints |
| `summary` | Project overview | Quick orientation before diving in |
| `listProjects` | Enumerate available projects | Multi-project repos |

Every tool returns deterministic output. The agent calls `getEntity("User")` and gets the same answer every time. No variance, no hallucination.

## Structured over prose

The worst MCP servers dump raw text. The agent has to parse it. The best return structured data:

```
// Bad: returns markdown
"User has email (required), password (required), and display_name (optional)"

// Good: returns typed JSON
{"entity": "User", "properties": {"email": "s!", "password": "s!", "display_name": "s"}}
```

Agents are machines. Give them machine-readable output. JSON with type codes (`s!` = required string, `n!` = required number) saves tokens and eliminates parsing errors.

## One .dag file, not fifty .dog files

Your spec might have 7 `.dog` files. Don't make the agent read all of them. Compile once into a `.dag` graph:

```
7 .dog files → 1 .dag file → 94% fewer tokens
12,000 tokens → 739 tokens → agent queries in <50ms
```

The agent never sees the source files. It queries the compiled graph through MCP tools. Your spec stays human-readable. The agent gets machine-optimized.

## Serve from the project root

Agents need context about where they are. Serve the MCP from the repo root. The agent discovers `specs/` and `projects/` directories automatically. No configuration. No path guessing.

## Test with real agents

Don't test with curl. Test with the agent you're building for. Ask it:

- "What entities exist in this project?"
- "What properties does User have?"
- "What depends on Payment?"

If the agent answers correctly every time, your MCP server works properly.

---

*[dotdog](https://github.com/specdog/dotdog) is an MCP server for specs. `npx dotdog serve` exposes your `.dag` to any agent. Six tools. Zero hallucination.*
