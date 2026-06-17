---
layout: default
title: "Spec-Driven Development Handbook"
description: "Specifications that ship. The complete guide to spec-driven development for teams and AI agents."
---

# Spec-Driven Development Handbook

## Specifications that ship

For decades, specifications were scaffolding — written once and discarded when the real work of coding began. Spec-Driven Development changes this: **specifications become executable.** They validate themselves. They guide AI agents. They catch drift before it becomes a bug.

GitHub calls it ["flipping the script"](https://github.com/github/spec-kit). Amazon calls it [working backwards](https://www.allthingsdistributed.com/2006/11/working_backwards.html). Stripe calls it [API-first](https://stripe.com/blog/api-first-development). The practice is the same: **write the spec first, then build.**

## Why write specs before code?

### AI agents need structure

An AI coding agent reads your README and guesses. It hallucinates entity names, invents relationships, misses required fields. When your spec is compiled into a typed graph, the agent queries exact data — not prose. Zero hallucination.

### Specs that verify themselves

A `.dog` file is not a static document. It is a validated contract. `dotdog validate` scores completeness. `dotdog compile` produces a token-efficient graph. `dotdog verify` checks properties exist in code. The spec becomes part of your CI pipeline.

### One source of truth

Product, engineering, and AI agents all read the same spec. No tribal knowledge. No "ask the senior engineer." The spec IS the answer — versioned, validated, queryable.

## The five-step practice

### 1. Specify

Write `.dog` files — structured Markdown with typed YAML entities. Define what your product does, what data it uses, what states it transitions through. Start with `SPEC.dog` and `data-model.dog`.

```bash
dotdog init my-project --minimal
```

### 2. Validate

Score completeness before every commit. Find gaps. Fill them. Get to 100%.

```bash
dotdog validate
dotdog analyze
```

### 3. Compile

Build a positional `.dag` graph. 94% smaller than the source. Optimized for AI agent context windows.

```bash
dotdog compile
```

### 4. Expose

Start the MCP server. Any MCP-compatible agent queries your spec — getEntity, traverse, search, schema, summary, listProjects.

```bash
dotdog serve
```

### 5. Verify

Map entities to code files. Detect when properties change or disappear. Catch drift between spec and implementation.

```bash
dotdog verify --init
dotdog verify
dotdog staleness
```

## Adoption paths

### New projects

Init a minimal spec before the first line of code. `dotdog init --minimal` creates SPEC.dog and data-model.dog. Fill them in. Validate. Then code against the spec.

### Existing codebases

Add dotdog alongside your codebase. Write SPEC.dog describing what already exists. Map entities to code files with `dotdog verify --init`. Grow the spec incrementally.

### Teams

Run `dotdog validate` in CI. Block PRs with broken specs. Run `dotdog staleness` to catch unaddressed tasks. Share the MCP server so every AI agent has access.

### Smart contracts and DeFi

One bug costs millions. Write the spec — entities, states, events, constraints. Validate. Generate Solidity stubs from the spec. Deploy with confidence.

### AI-first products

Building a product where AI agents are the primary user? Your spec is their API. Agents query entities, traverse relationships, check states. The spec is the contract between your system and every agent that touches it.

## How dotdog compares

| | dotdog | spec-kit | OpenSpec | Shotgun |
|---|--------|----------|----------|---------|
| Format | .dog (Markdown + YAML) | Markdown directories | Markdown proposals | YAML spec files |
| Validation | Built-in scoring | Manual review | Manual review | Manual review |
| AI agent access | MCP server (6 tools) | Slash commands | CLI proposals | CLI injection |
| Token efficiency | 94% savings (.dag) | Raw prose | Raw prose | Raw prose |
| Drift detection | verify + staleness | None | None | None |
| Dogfooded | 100% on itself | Unknown | Unknown | Unknown |

## Further reading

- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [Why dotdog? Compare with alternatives](why-dotdog)
- [Martin Fowler on SDD tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [Amazon's Working Backwards](https://www.allthingsdistributed.com/2006/11/working_backwards.html)
- [GitHub spec-kit: Spec-Driven Development](https://github.com/github/spec-kit)
