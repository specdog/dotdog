# Machine-First Spec-Driven Design Thesis

Dotdog should become the machine-first file system for software intent and implementation reality.

The human layer is HL: `.dog`, `.md`, docs, plans, tickets, comments, and decisions. HL is writable by humans and reviewable in Git.

The machine layer is ML: `.dag`, `.idx`, compact graph facts, and MCP query responses. ML is what agents should search first because it is smaller, deterministic, traversable, and less ambiguous than prose.

## Core belief

Agents should not begin by reading every file. They should begin by querying the compiled graph. The graph should answer: what exists, where it lives, what it depends on, what implements it, what tests it, what config controls it, and what human intent explains it.

HL remains the source of truth for meaning. ML becomes the source of truth for execution context.

## Product objective

Dotdog must support both project creation and repo ingestion. A new project starts with `dotdog init`. An existing project starts with `dotdog map`. Both converge into the same workspace:

```text
HL: .dog/.md/specs/plans/tasks/docs
        -> validate
ML: .dag/.idx/repo graph
        -> serve/query
Agent/orchestrator action
```

## Required behavior

1. Search DAG first. Only fall back to `.dog` or `.md` when graph evidence is missing.
2. Treat `.dog` as human-authored intent and `.dag` as machine execution substrate.
3. Map existing repos into implementation facts: files, routes, components, APIs, handlers, schemas, migrations, env vars, tests, workflows, packages, docs, and specs.
4. Preserve provenance: every graph fact should point back to a path or source.
5. Support living documentation: repo changes update graph facts, then docs can be regenerated selectively from impacted nodes.
6. Support app simulation: scenarios traverse product intent, implementation nodes, tests, infra, and runtime contracts.

## Strategic position

Dotdog = human-readable spec + machine-readable repo graph + MCP query surface.

Leash should be the runtime/control surface that guides agents through graph-first execution. Collar should be the lightweight local harness/adapter that keeps agents constrained to the graph, terminal, and repo evidence. JBrain proves the broader doctrine: humans own meaning; agents consume compiled models; digital twins and app twins are models, not authorities.

## Implementation phases

### Phase A: repo map baseline

Ship `dotdog map [dir]` and `dotdog init --map`. Emit `repo-map.dog` without overwriting hand-written specs. Compile it into `.dag`.

### Phase B: DAG-first query contract

Add a shared graph loader used by `serve`, `search`, `visualize`, `live`, `simulate`, and future commands. Every command should attempt `.dag` first, then HL fallback.

### Phase C: richer extractors

Add framework-aware extractors for Next.js, Vite, Express, Fastify, Prisma, Drizzle, Supabase, Vercel, GitHub Actions, tests, package scripts, and env examples.

### Phase D: impact and simulation

Given a changed file or desired feature, traverse impacted graph nodes: product spec, route, handler, schema, tests, env, infra, docs, and tasks. Simulation should run over DAG edges before reading prose.

### Phase E: living docs

Generate or refresh docs from impacted graph neighborhoods, not whole repos. Documentation should explain the system because the graph already knows the system.
