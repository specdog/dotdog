---
layout: default
title: "Spec-Driven Development"
description: "Write specs first. Validate. Compile. Let AI agents query them. No hallucination."
---




# Spec-Driven Development

Write specs before code. Validate completeness. Compile to a graph AI agents can query. No hallucination.

## Why

AI agents read prose and guess. They hallucinate entity names, invent relationships, miss required fields.

A compiled `.dag` graph is 94% smaller than source — the agent loads exact data, not prose.

## How

```bash
npm install -g dotdog       # install
dotdog init my-app          # scaffold specs
dotdog validate             # score completeness
dotdog compile              # build .dag graph
dotdog serve                # expose to AI agents
```

Five minutes from zero to AI agents querying your specs.

## The practice

1. **Specify** — write `.dog` files with entities, properties, states
2. **Validate** — score completeness before every commit
3. **Compile** — build a token-efficient graph
4. **Expose** — MCP server for AI agents
5. **Verify** — detect drift between spec and code

## Who uses this

- **New projects** — spec before code. `dotdog init --minimal`
- **Existing codebases** — add specs alongside code. `dotdog verify --init`
- **Teams** — validate in CI, share MCP server
- **Smart contracts** — one bug costs millions. Spec first.

## Further reading

- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [Martin Fowler on SDD](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [GitHub spec-kit](https://github.com/github/spec-kit)
