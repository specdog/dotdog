---
layout: default
title: "Why AI Coding Agents Need Structured Specs"
date: 2026-06-17
author: Justin Diclemente
description: "AI agents hallucinate entity names and invent relationships. Structured specs give them ground truth."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents · dogfood](https://specdog.github.io/agents)


# Why AI Coding Agents Need Structured Specs

AI coding agents are everywhere. Copilot in VS Code. Claude Code in the terminal. Cursor in the browser. They write functions, scaffold components, and ship PRs faster than any human.

They also hallucinate. Constantly.

Show an agent a prose spec and it guesses. It renames your `PaymentReceipt` to `Receipt`. It treats `email` as optional when it's required. It invents a `username` field you never asked for. Every guess is a bug you have to catch in review.

The fix: don't make agents guess.

## Prose is lossy

Here's a real-world product spec:

```
Users can sign up with email and password. Each user belongs to one
organization. Organizations have access rules...
```

An AI agent reads this and builds a user system. But it fills in blanks with plausible-sounding hallucinations:

- "Password must be at least 8 characters" — where did that come from?
- "User has a `role` field" — you didn't specify that
- "Organization has a `name` and `created_at`" — the agent guessed

Every hallucinated field is maintenance debt.

## Structured specs are deterministic

The same spec, structured:

```
Entity: User
  email: string!
  password_hash: string!
  org_id: string! → Organization.id
  states: [active, suspended]

Entity: Organization
  name: string!
  plan: enum[trial, pro, enterprise]!
  states: [trial, active, cancelled]
```

The agent doesn't guess. It queries the `.dag` graph:

```
getEntity("User")    → exact fields, types, required flags
traverse("User", 2)  → Organization, BillingPlan, everything connected
```

Zero ambiguity. Zero hallucination. The agent builds exactly what you specified.

## The cost of guessing

Hallucination isn't free:

- **Review time** — every guessed field is a conversation. "Why did you add `role`?" "The spec seemed to imply..."
- **Refactoring** — the wrong data model ripples through every component
- **Bugs** — optional fields treated as required, wrong types, missing cascades
- **Trust** — if you can't trust the agent's output, you're reviewing everything anyway

A structured spec eliminates the guessing. The agent's job becomes translation, not interpretation.

## This isn't new — compilers do it

When you write TypeScript, the compiler checks types. When you write SQL, the database enforces constraints. When you write HTML, the browser validates structure.

AI coding agents had none of this. Until now.

Spec-driven development gives agents the same deterministic foundation that compilers give code.

---

*[dotdog](https://github.com/specdog/dotdog) — write specs, compile graphs, serve to agents. `npm install -g dotdog`.*

## References

- **MCP Protocol**: Anthropic. "Model Context Protocol." modelcontextprotocol.io, 2024. Open standard for AI agent tool integration.
- **Agent Hallucination**: Xu et al. "Hallucination is Inevitable: An Innate Limitation of Large Language Models." arXiv:2401.11817, 2024. Proves hallucination is a mathematical inevitability in LLMs.
- **Karpathy LLM Wiki**: Karpathy, Andrej. "LLM Wiki." gist.github.com/karpathy, 2026. Architecture for persistent, queryable agent knowledge bases.
