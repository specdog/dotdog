---
layout: default
title: "Specs as Living Documentation"
date: 2026-06-17
author: Justin Diclemente
description: "Documentation rots. Specs that compile into graphs stay current because AI agents depend on them."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Specs as Living Documentation

Documentation rots. You write a README, a wiki page, a Notion doc. Six months later it's wrong. The code moved on. The docs stayed behind.

Specs are different — if an AI agent depends on them, they can't rot.

## The documentation death spiral

1. Write docs. They're accurate.
2. Ship features. The code changes.
3. Docs don't update. They're now wrong.
4. New team members read wrong docs. They write wrong code.
5. Trust in docs evaporates. Nobody reads them anymore.

This happens because docs have no consumer. Nobody's job depends on them being right.

## Specs have a consumer: the AI agent

When your CI pipeline compiles specs into a `.dag` and your AI agent queries it:

1. Agent wants to build `PaymentBubble` component
2. Agent queries: `getEntity("PaymentBubble")`
3. Returns: exact fields, states, relationships
4. Agent builds the component

If the spec is wrong, the agent builds wrong code. The spec MUST be right.

## Compilation as enforcement

Traditional docs: human reads, human decides if it's current. Nobody checks.

Compiled specs: `dotdog validate` scores completeness. `dotdog staleness` detects drift. The pre-commit hook blocks if score drops.

```
$ dotdog validate
  my-project : 7 .dog files, 100% complete

$ dotdog staleness
  my-project: spec matches reality
```

The tool enforces what humans can't — every spec is verified every time.

## From write-once to continuous

Living documentation means:

1. **Write specs during planning** — entities, relationships, constraints
2. **Validate on every commit** — pre-commit hook blocks regressions
3. **Agent queries at build time** — never stale, always current
4. **Staleness checks in CI** — spec drift detected before merge

The documentation isn't a separate artifact. It's the source of truth the agent depends on.

## Beyond code: predictions and roadmap

Specs can track more than code structure:

- **Predictions** — "Ships by July" with confidence score, measured against reality
- **Tasks** — work items with dependencies, priorities, completion probabilities
- **Constitution** — immutable rules the project must satisfy

The spec becomes the project's operating system. The code is output. The agent is the CPU.

---

*[dotdog](https://github.com/specdog/dotdog) — specs that stay current because agents depend on them. `npm install -g dotdog`.*

## References

- **Documentation Decay**: Aghajani et al. "Software Documentation Issues Unveiled." IEEE/ACM ICSE 2019. Analyzed 878 documentation issues across 5 projects — 47% were outdated content.
- **Living Documentation**: Smart, John Ferguson. "BDD in Action." Manning, 2014. Introduced the concept of executable specifications that stay current because tests depend on them.
- **Staleness Detection**: dotdog staleness command. Compares plan.dog tasks against codebase file existence — detects spec/reality drift in linear time.
