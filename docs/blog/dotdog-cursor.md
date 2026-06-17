---
layout: default
title: "How to Use dotdog with Cursor"
date: 2026-06-17
author: Justin Diclemente
description: "Cursor's agent mode queries dotdog specs via MCP. Every entity, relationship, and property is deterministic."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# How to Use dotdog with Cursor

Cursor's agent mode is the most capable AI coding experience. Give it your project specs via dotdog MCP and it stops guessing.

## Setup

Create `.cursor/mcp.json`:

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

Restart Cursor. Open Cmd+I and ask about your specs.

## Agent mode vs regular chat

In regular chat, Cursor reads your code and guesses. In agent mode with dotdog, Cursor:

1. **Knows your entities** — `getEntity("Order")` returns exact fields
2. **Traverses relationships** — `traverse("Order", 2)` finds everything connected
3. **Checks constraints** — `schema("Order")` shows required fields, types, enums
4. **Searches across projects** — `search("Payment")` finds all entities matching

## Example

```
Compile your specs first:

$ dotdog compile
  ✓ dotdog.dag (11 nodes, 5 edges)

Then ask Cursor:

You: Build a checkout flow for the Order entity

Cursor (agent mode):
  → getEntity("Order")
  → traverse("Order", 2)
  → getEntity("Payment")
  → getEntity("Cart")

Generates complete checkout component with:
  - Order status flow (pending → confirmed → shipped)
  - Payment integration with exact field names
  - Cart-to-Order conversion
  - Error states from constitution.dog
```

Every generated file matches your spec. The agent doesn't interpret prose — it reads structured data.

## Multi-project repos

If your repo has multiple projects, Cursor sees all of them:

```
specs/
  backend/     # API spec with endpoint entities
  frontend/    # Component spec with screen entities
  shared/      # Shared types and enums
```

Cursor can query across projects. `search("User")` finds the entity in all three.

---

*[dotdog](https://github.com/specdog/dotdog) — Cursor + dotdog = specs-driven agent mode. `npm install -g dotdog`.*
