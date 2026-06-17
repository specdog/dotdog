---
layout: default
title: "How to Use dotdog with GitHub Copilot"
date: 2026-06-17
author: Justin Diclemente
description: "Give Copilot access to your project specs via MCP. Stop hallucinated entity names and wrong relationships."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# How to Use dotdog with GitHub Copilot

Copilot is great at generating code. It's terrible at knowing your project's domain model. dotdog fixes this.

## Setup

Add dotdog as an MCP server in your Copilot MCP configuration:

```json
{
  "servers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Add context instructions to `.github/copilot-instructions.md`:

```markdown
This project uses dotdog for specs. Query the dotdog MCP server for:
- Entity definitions (getEntity)
- Relationships between entities (traverse)
- Required properties and types (schema)

Run `dotdog compile` before querying. The .dag file is in specs/<project>/.
```

## How Copilot uses specs

When you ask Copilot to build a feature, it queries dotdog first:

```
You: Build a user registration form

Copilot → getEntity("User")
       → email: string!, password: string!, email_verified: bool
       → traverse("User", 1)
       → depends on Organization, connects to Session

Copilot generates the form. Every field matches the spec. No hallucination.
```

Without dotdog, Copilot guesses what fields User has. With dotdog, it knows.

## Real example

```
$ dotdog compile
  ✓ my-app.dag (93% savings)

You: Add a payment method to the User entity

Copilot:
  1. Queries getEntity("User") — sees existing fields
  2. Queries getEntity("PaymentMethod") — sees the related entity
  3. Generates the migration, model, and form
  4. All fields match the spec exactly
```

The spec isn't documentation Copilot ignores. It's ground truth Copilot queries.

---

*[dotdog](https://github.com/specdog/dotdog) — give Copilot your actual domain model. `npm install -g dotdog`.*
