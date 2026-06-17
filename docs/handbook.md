---
layout: default
title: "Spec-Driven Development Handbook"
description: "How to practice spec-driven development — write specs first, validate, compile, and let AI agents query them."
---

# Spec-Driven Development Handbook

## What is SDD?

Spec-Driven Development flips the traditional workflow. Instead of code first, spec later, you write the spec before any code is written. The spec becomes the source of truth — humans read it, AI agents query it, CI validates it.

```
 Traditional:  code → maybe docs → maybe spec
 SDD:           spec → validate → code → verify
```

## Why does this matter?

### AI agents need structure

An AI coding agent reads your README and guesses. It hallucinates entity names, misses required fields, invents relationships. With SDD, the agent queries your spec via MCP — exact entity names, typed properties, defined states, verified relationships.

### Specs that do not rot

A wiki page is written once and never updated. A .dog file is validated on every commit. If the spec says email is required and the code makes it optional, staleness catches it.

### One source of truth

Product, engineering, and AI agents all read the same spec. No more tribal knowledge. No more "ask the senior dev." The spec IS the answer.

## The core practice

### 1. Write the spec first

Before any code, define your product, entities, and user stories. Use .dog files — structured Markdown + YAML that both humans and parsers understand.

### 2. Validate completeness

Run `dotdog validate` before every commit. The tool scores completeness — missing entities, unreferenced relationships, empty descriptions. Get to 100pct.

### 3. Compile for AI agents

`dotdog compile` builds a positional .dag graph — 94pct smaller than the source. AI agents load this in a fraction of the context window instead of reading dozens of prose files.

### 4. Expose via MCP

`dotdog serve` starts an MCP server. Any MCP-compatible AI agent queries your spec — zero hallucination. Six tools: getEntity, traverse, search, schema, summary, listProjects.

### 5. Detect drift

Run `dotdog verify --init` to map entities to code files. Run `dotdog verify` to check properties still exist. Run `dotdog staleness` to check plan.dog task completion. Catch drift before it ships.

## When to adopt

- **New projects**: Init with `dotdog init --minimal`. Write SPEC.dog and data-model.dog before the first line of code.
- **Existing projects**: Add dotdog alongside the codebase. Start with SPEC.dog describing what already exists. Grow from there.
- **Teams**: Run validate in CI. Block PRs with broken specs. Share the MCP server with AI coding agents.
- **Smart contracts / DeFi**: One bug costs millions. Write the spec. Validate. Generate Solidity stubs. Deploy with confidence.

## Further reading

- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [Why dotdog? Compare with alternatives](why-dotdog)
- [Spec-Driven Development methodology](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) (Martin Fowler)
