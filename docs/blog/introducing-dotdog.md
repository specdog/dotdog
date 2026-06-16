---
layout: default
title: "dotdog — Specs AI Agents Can Actually Use"
date: 2026-06-16
author: Justin Diclemente
description: "Write specs in .dog files. Validate, compile, and serve them to AI agents via MCP. Zero hallucination."
---

Specs rot. They live in wikis, Google Docs, or Notion — written once, never read again. AI agents read prose and guess. Hallucinations compound.

## What dotdog does

Write specs in `.dog` files — Markdown + structured YAML. Run `dotdog validate` to score completeness. Run `dotdog compile` to build a `.dag` graph. Run `dotdog serve` to expose it to any MCP-compatible AI agent.

The agent doesn't read prose. It calls `getEntity`, `traverse`, `search` — gets typed data with properties, states, and relationships. Zero hallucination.

## Quick example

```bash
npm install -g dotdog
dotdog init my-project
# Fill in SPEC.dog and data-model.dog
dotdog validate         # → 100% complete
dotdog compile          # → 94% token savings
dotdog serve            # → AI agents query your specs
```

## Why it works

The `.dag` graph is positional JSON — no keys, no prose, no empty fields. 94% smaller than source `.dog` files. An LLM loads the entire spec in a fraction of the context window.

## Try it

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Docs](https://specdog.github.io/dotdog)
