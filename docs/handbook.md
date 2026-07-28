---
layout: default
title: "Spec-Driven Development"
description: "Write intent, validate it, compile a graph, inspect connections, and let tools query it."
---




# Spec-Driven Development

Write intent before code. Validate completeness. Compile a graph people can inspect and tools can query.

## Why

People and AI agents reconstruct project context from scattered prose and code. That makes names, constraints, and relationships easy to miss.

A compiled `.dag` graph is 94% smaller than source — the agent loads exact data, not prose.

## How

```bash
npm install -g dotdog       # install
dotdog init my-app          # scaffold specs
dotdog validate             # score completeness
dotdog compile              # build .dag graph
dotdog visualize specs/my-app/my-app.dag --format html --save
dotdog serve                # expose to AI agents
```

Five minutes from zero to AI agents querying your specs.

## The practice

1. **Specify** — write `.dog` files with entities, properties, states
2. **Validate** — score completeness before every commit
3. **Compile** — build a token-efficient graph
4. **Visualize** — inspect real nodes and connections
5. **Expose** — MCP server for AI agents
6. **Observe** — map existing repository reality
7. **Verify** — detect drift between intent and implementation

## Who uses this

- **New projects** — spec before code. `dotdog init --minimal`
- **Existing codebases** — add specs alongside code. `dotdog verify --init`
- **Teams** — validate in CI and use local MCP configurations; secure any shared gateway separately
- **Specdog public site** — keep docs, blog, and discovery pages current
- **Lean workflow** — one issue, one PR, one merge; spec/.dag first; verify with tests; keep status compact
- **Smart contracts** — one bug costs millions. Spec first.

## Further reading

- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [Exact greenfield, existing repository, Spec Kit, and workspace workflows](workflows)
- [Martin Fowler on SDD](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [GitHub spec-kit](https://github.com/github/spec-kit)
