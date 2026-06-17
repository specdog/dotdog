---
layout: default
title: "How to Use dotdog with Claude Code"
date: 2026-06-17
author: Justin Diclemente
description: "Connect dotdog to Claude Code via MCP. Your specs become queryable entities — zero hallucination."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents · dogfood](https://specdog.github.io/agents)


# How to Use dotdog with Claude Code

Claude Code is Anthropic's terminal-based AI coding agent. It reads your codebase, writes code, and executes commands. With dotdog, it also reads your specs.

## Setup

Create `.mcp.json` in your project root:

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

Restart Claude Code. That's it.

## What happens

Claude Code discovers dotdog as an MCP server. Six tools become available:

| Tool | What it does |
|------|-------------|
| `getEntity` | Returns one entity with all properties |
| `traverse` | Follows edges from a node — full subgraph |
| `search` | Finds entities by name or type |
| `schema` | Returns property definitions with types |
| `summary` | Project overview with node count |
| `listProjects` | Lists all projects in the repo |

## Try it

```
$ claude

> What projects do I have in this repo?
> Show me the data model for the User entity
> What entities depend on Payment?
```

Claude queries your compiled `.dag` graph. No scanning prose. No guessing field names. Every response is from your actual spec.

## Compile first

Claude reads the `.dag`, not the `.dog` files. Run `dotdog compile` before starting:

```bash
dotdog compile    # builds specs/project/project.dag
claude            # agent reads .dag via MCP
```

## Where specs go

Your specs live in `specs/<project>/`:

```
specs/
  my-app/
    SPEC.dog           # product description, user stories
    data-model.dog     # entities, relationships, states
    constitution.dog   # invariants and constraints
```

Claude queries all of these through the compiled graph. One file to read, six tools to navigate.

---

*[dotdog](https://github.com/specdog/dotdog) — `npm install -g dotdog` or `brew install dotdog`.*
