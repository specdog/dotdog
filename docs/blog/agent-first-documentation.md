---
layout: default
title: "Agent-First Documentation — The New Standard"
date: 2026-06-17
author: Justin Diclemente
description: "Write .dog for humans. Compile .dag for agents. Never let an AI read prose again."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Agent-First Documentation — The New Standard

Documentation was built for humans. READMEs, wikis, Notion pages, markdown files — all designed to be read by developers scrolling in a browser. AI coding agents don't scroll. They scan, guess, and hallucinate.

Agent-first documentation fixes this. Write specs for humans in `.dog` files. Compile them into `.dag` graphs for agents. The agent never reads the raw source. It queries the compiled graph. Zero scanning. Zero hallucination.

## The problem: AI agents can't read

When Claude Code or Copilot reads a README:

```
The User entity has an email and password. Users belong to
one Organization. When a user signs up...
```

The agent scans these 72 words and guesses. It decides `email` is required, `password` is hashed, and `Organization` has a `name` field. Two of those three guesses are wrong. The agent hallucinated.

When the agent queries a compiled `.dag`:

```
getEntity("User") → email: string!, password_hash: string!
traverse("User", 1) → Organization: name!, plan: enum[trial,pro,enterprise]!
```

Every field is exact. Every relationship is verified. Zero hallucination. The agent doesn't interpret — it queries.

## The architecture

```
Human → writes .dog (readable markdown + structured YAML)
      → runs dotdog compile
      → generates .dag (compiled knowledge graph, 94% smaller)

Agent → connects via MCP
      → queries .dag (getEntity, traverse, search, schema)
      → NEVER reads .dog or .md for project structure
```

The `.dog` file is human format. The `.dag` file is agent format. They're the same data, compiled for different consumers. The compiler enforces separation.

## The rules

| Format | Human | Agent | Purpose |
|--------|-------|-------|---------|
| `.dog` | Writes + reads | NEVER touches | Spec source (markdown + structured YAML) |
| `.dag` | Never touches | Queries via MCP | Compiled knowledge graph |
| `.md` | Reads | Reads for context only | General documentation (blog, README) |

When an agent needs to know "what fields does User have," it queries `getEntity("User")` via MCP. It doesn't grep for `### Entity: User` in a `.dog` file. It doesn't scan a README paragraph. It gets typed, verified data from the graph.

## Prior art

Andrej Karpathy described the concept of a "LLM Wiki" in 2026 — raw sources compiled into a queryable wiki that LLMs traverse instead of scanning prose. The architecture: raw sources → compiled wiki → LLM queries.

Karpathy described the idea. dotdog built the product.

## Why now

Three things happened in 2024-2026:

1. **MCP became a standard.** Anthropic's Model Context Protocol gave agents a universal way to talk to tools. Every major agent — Claude Code, Copilot, Cursor — speaks MCP.
2. **Compiled formats proved necessary.** The v2 positional DAG format is 94% smaller than source. Agents load 739 tokens instead of 12,000. Context windows are precious.
3. **Hallucination became measurable.** Xu et al. (arXiv 2024) proved hallucination is mathematically inevitable in LLMs. The only mitigation is structured input.

Agent-first documentation is the structured input agents need.

## What's next

Every project will have two documentation surfaces:

- **Human surface**: `.dog` files, `.md` files, website, blog — readable, scannable, writable
- **Agent surface**: `.dag` graph, MCP server, six query tools — typed, structured, deterministic

The pipeline is open source. The format is open. The protocol is open. Build on it.

---

*[dotdog](https://github.com/specdog/dotdog) — the first agent-first documentation CLI. `npm install -g dotdog`. Feed the dog.*
