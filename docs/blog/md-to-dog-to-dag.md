---
layout: default
title: "From .md to .dag — The Migration Path"
date: 2026-06-17
author: Justin Diclemente
description: "Every .md file is a valid .dog file. Add entities. Compile to .dag. Agents stop hallucinating."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# From .md to .dag — The Migration Path

You have a README. You have docs in Markdown. AI agents scan them and guess. Here's the zero-cost path to giving agents ground truth.

## Step 1: Convert

```bash
dotdog convert README.md
# → README.dog (identical content, now compilable)
```

Every `.md` file is a valid `.dog` file. The conversion is a rename. No content changes. No breaking anything.

## Step 2: Add structure

Open `README.dog` and add an entity:

```yaml
### Entity: User

```yaml
entity: User
type: entity
properties:
  email:
    type: string
    required: true
  name:
    type: string
    required: true
states: [active, suspended]
lifecycle: active → suspended
```
```

One entity. One YAML block. The rest of your README stays exactly as it was.

## Step 3: Compile

```bash
dotdog compile
# → specs/project/project.dag (94% smaller than .dog source)
```

The `.dag` file is the compiled knowledge graph. AI agents query it instead of scanning prose.

## Step 4: Agents query the graph

```
Agent: "What entities exist in this project?"
MCP:   getEntity("User") → email:s!, name:s!, states:[active, suspended]
```

Zero hallucination. The agent doesn't guess field names — it queries the graph.

## The migration path

| Step | Command | What changes |
|------|---------|-------------|
| Convert | `dotdog convert README.md` | .md → .dog (no content change) |
| Structure | Edit .dog, add `### Entity:` blocks | Add entities as you go |
| Compile | `dotdog compile` | .dog → .dag (94% smaller) |
| Query | `dotdog serve` | Agents get ground truth |

You don't convert everything at once. You add one entity. Compile. See the agent stop guessing. Add another.

## .md still works

Your `.md` files still work. GitHub renders them. Your website serves them. Your team reads them. The `.dog` file is a superset — everything that worked before still works, plus agents get structure.

---

*[dotdog](https://github.com/specdog/dotdog) — `dotdog convert README.md` is your first step. Zero risk. `npm install -g dotdog`.*
