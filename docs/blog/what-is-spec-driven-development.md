---
layout: default
title: "What Is Spec-Driven Development?"
date: 2026-06-17
author: Justin Diclemente
description: "Write specs first. Validate them. Compile them into graphs. Give AI agents ground truth. Zero hallucination."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# What Is Spec-Driven Development?

Software has always had specs. PRDs, design docs, API specs, RFCs. The problem: AI coding agents can't read them. They scan prose and guess. They hallucinate entity names, invent relationships, and miss required fields.

Spec-driven development fixes this. You write specs in a structured format. A tool validates them, compiles them into a graph, and serves them to AI agents. The agent queries the graph instead of scanning paragraphs. Hallucination drops to near zero.

## The problem with prose

Here's what AI agents see when you give them a traditional spec:

```
The User entity has an email and a password. When a user signs up,
we validate the email format and hash the password using bcrypt...
```

The agent reads this, then writes code. Sometimes it's right. Sometimes it guesses `username` is required when it's not. Sometimes it forgets `email_verified` exists. Every mistake is a bug.

Here's what the agent sees with a structured spec:

```
Entity: User
  properties:
    email: string!       (required)
    password: string!    (required, hashed)
    email_verified: bool  (default false)
    created_at: string!  
  states: [active, suspended, deleted]
```

No ambiguity. No guessing. The agent knows exactly what to build.

## The .dag — compile once, query forever

Raw spec files are useful. But agents scanning 600 lines of prose burn tokens and attention. The compiled `.dag` graph is 94% smaller. Eleven entities, five relationships — 739 tokens instead of 12,000.

Agents don't read the `.dog` files. They load the `.dag` and query it:

```
getEntity("User") → exact properties, states, lifecycle
traverse("User", depth=2) → full subgraph of dependencies
```

One file. Six MCP tools. Every query is deterministic.

## TDD vs spec-driven development

| Test-driven development | Spec-driven development |
|-------------------------|------------------------|
| Tests verify behavior | Specs define structure |
| Red → green → refactor | Write → validate → compile → serve |
| For compilers and CI | For AI coding agents |
| Catches bugs after code | Prevents bugs before code |

They're complementary. Tests verify that code works. Specs tell AI agents what to build. Use both.

## Why now

AI coding agents are in every editor. They write more code than humans. But they still hallucinate because they don't have ground truth. Spec-driven development gives them ground truth. The structure you already have — entities, relationships, states, lifecycles — goes from prose to queryable graph.

Write specs. Feed the dog. Ship with confidence.

---

*[dotdog](https://github.com/specdog/dotdog) is the CLI tool for spec-driven development. `npm install -g dotdog`. Feed the dog.*
