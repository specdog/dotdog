---
layout: default
title: "Spec-Driven vs Test-Driven Development"
date: 2026-06-17
author: Justin Diclemente
description: "TDD verifies code works. SDD tells AI agents what to build. You need both."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Spec-Driven vs Test-Driven Development

Test-driven development taught us to write tests first. Red-green-refactor. Tests verify behavior. They catch regressions. They document intent through assertions.

Spec-driven development solves a different problem: AI coding agents need to know what to build before they write a single line.

## They solve different problems

| | Test-Driven | Spec-Driven |
|---|---|---|
| **Answers** | "Does this work?" | "What should this be?" |
| **Audience** | Compiler, CI, humans | AI coding agents |
| **Format** | Code (assertions) | Structured specs (.dog → .dag) |
| **Catches** | Bugs after code exists | Bugs before code is written |
| **Flow** | Red → green → refactor | Write → validate → compile → serve |

TDD says "make this function return 42." SDD says "this function exists, takes these parameters, returns this type."

## The workflow: use both

1. **Write specs** — define entities, relationships, states, properties
2. **Validate** — check completeness (100% means zero missing fields)
3. **Compile** — build the `.dag` graph (94% smaller than source)
4. **AI agent writes code** — agent queries `.dag` via MCP, generates implementation
5. **Tests verify** — existing TDD cycle runs against generated code
6. **Specs stay in sync** — as code changes, specs update → recompile → agent knows

The spec is the source of truth for structure. The tests are the source of truth for behavior.

## What TDD can't do

A test suite can't tell an AI agent:

- Which fields are required vs optional
- What states an entity passes through
- How entities relate to each other
- What the cardinality of a relationship is

A spec can. And when both exist, the agent has ground truth for structure AND tests for behavior.

## The future: specs feed agents, tests verify output

The best teams will write specs that AI agents consume, then write tests that verify the agent's output. The human writes the spec and the tests. The agent writes the implementation in between.

---

*[dotdog](https://github.com/specdog/dotdog) — the CLI for spec-driven development. `npm install -g dotdog`.*
