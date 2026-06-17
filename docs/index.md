---
layout: default
title: "dotdog — Spec-driven development CLI"
description: "Write structured specs. Validate completeness. Compile to graphs. AI agents query via MCP."
---

# dotdog

> Write specs, validate completeness, compile to graphs, let AI agents query them.

## Install

```
npm install -g dotdog
```

## See it work

dotdog validates itself. This is real output from the tool checking its own spec:

```
$ dotdog validate
  spec-platform : 7 .dog files, 100% complete

$ dotdog compile
  ✓ spec-platform.dag
  11 nodes, 5 edges, 7 files
  12,110 → 739 tokens (93.9% savings)
```

**100% complete** means every required file exists, every entity has properties, and no gaps were found. The `.dag` graph is 93.9% smaller than the source `.dog` files — AI agents load exact data instead of prose.

## What each command does

| Command | What it does |
|---------|-------------|
| `dotdog init` | Scaffold a spec genome — SPEC.dog, data-model.dog, and optional files |
| `dotdog validate` | Score completeness. Find missing entities, empty descriptions, broken relationships |
| `dotdog compile` | Build a positional .dag graph. 94% smaller than source, optimized for LLM context |
| `dotdog serve` | Start MCP server. AI agents query via getEntity, traverse, search, and more |
| `dotdog verify` | Map entities to code files. Detect when properties change or disappear |
| `dotdog staleness` | Check plan.dog task completion. Catch unaddressed work |

## AI Agent Setup

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

Six MCP tools: `getEntity`, `traverse`, `search`, `schema`, `summary`, `listProjects`.

## More

- [Handbook: Spec-Driven Development](handbook)
- [Tutorial: Build a spec-driven project](tutorial)
- [FAQ](faq)

---

dotdog@<span id="version">0.5.0</span> · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE) · [GitHub](https://github.com/specdog/dotdog) · [npm](https://www.npmjs.com/package/dotdog)
