# Spec-Driven Repo Mapping

This document defines the next product direction for dotdog: turn a project plan or an existing repository into a structured spec workspace, then compile that workspace into an agent-readable implementation graph.

## Product Position

dotdog is a spec-driven design toolchain.

It supports two starting points:

1. Empty project: create the foundation for a project to be specified before implementation.
2. Existing project: inspect the repo and map current implementation into a spec workspace.

The core loop is:

```text
plan -> spec workspace -> validation -> implementation graph -> agent execution -> mapped reality -> better spec
```

## Command Direction

```bash
dotdog init <project>
dotdog init <project> --minimal
dotdog init <project> --map
dotdog map [dir]
dotdog validate [dir]
dotdog compile [dir]
dotdog serve [dir]
```

`dotdog init` creates the spec workspace.

`dotdog init --map` should create the workspace and immediately seed it from the current repo.

`dotdog map` should inspect an existing repo and write inferred project structure into `.dog` files.

`dotdog compile` should emit `.dag` graph output that agents can query through MCP.

## What init Should Create

A full init should create:

```text
specs/<project>/
  INDEX.dog
  SPEC.dog
  constitution.dog
  data-model.dog
  plan.dog
  COPY.dog
  tasks.dog
  tasks/
    AGENTS.dog
```

Each file has a role:

- `INDEX.dog`: entrypoint and navigation map.
- `SPEC.dog`: product intent, flows, user stories, and system behavior.
- `constitution.dog`: constraints, rules, boundaries, and non-negotiables.
- `data-model.dog`: entities, schemas, states, and relationships.
- `plan.dog`: phased implementation plan.
- `COPY.dog`: user-facing language and UI text.
- `tasks.dog`: implementation tasks tied to specs.
- `tasks/AGENTS.dog`: agent instructions and handoff rules.

## What map Should Discover

`dotdog map` should detect implementation structure and create graph-ready facts.

Target node types:

- files
- directories
- packages
- frontend components
- routes
- pages
- API endpoints
- backend handlers
- services
- schemas
- database tables
- migrations
- environment variables
- cloud resources
- CI workflows
- tests
- tasks
- specs

Target edge types:

- imports
- calls
- renders
- reads
- writes
- depends_on
- implements
- configured_by
- deployed_by
- tested_by
- documented_by
- owned_by

The graph should expose complex cross-layer paths such as:

```text
frontend component -> API route -> backend handler -> schema -> database table -> env var -> infra resource -> task/spec reason
```

## Agent Use Cases

Agents should be able to ask:

- Where does this frontend state come from?
- What route feeds this component?
- What backend handler owns this behavior?
- What database table or schema stores this entity?
- What environment variable controls this integration?
- What infrastructure resource deploys or configures this feature?
- What spec explains why this code exists?
- What task should be changed if this behavior changes?

## Example Map Output

```dog
### Entity: CheckoutPage

Frontend checkout screen.

```yaml
entity: CheckoutPage
type: component
file: src/app/checkout/page.tsx
renders:
  - CartSummary
calls:
  - POST /api/checkout
depends_on:
  - NEXT_PUBLIC_STRIPE_KEY
implements:
  - Checkout Flow
```

### Entity: Checkout API

Backend endpoint that creates checkout sessions.

```yaml
entity: Checkout API
type: api_route
route: POST /api/checkout
file: src/app/api/checkout/route.ts
calls:
  - Stripe Checkout Session
writes:
  - orders
depends_on:
  - STRIPE_SECRET_KEY
implements:
  - Checkout Flow
```
```

## Implementation Plan

Phase 1: make init clearer.

- Rename output language from “spec genome” to “spec workspace.”
- Print the created tree after init.
- Explain what to edit first.
- Explain that `.dog` is source spec and `.dag` is compiled graph.
- Use `dotdog validate` in output, not `spec validate`.

Phase 2: add repo map MVP.

- Detect package manager and framework.
- Read `package.json`, routes, app/pages folders, src folders, config files, env examples, and workflows.
- Emit `repo-map.dog` with observed files, inferred components, routes, env vars, and unknowns.
- Do not overwrite hand-written specs unless explicitly requested.

Phase 3: connect mapped facts into compile.

- Compile repo-map entities into `.dag` nodes.
- Compile imports/calls/renders/depends_on into edges.
- Add MCP traversal examples for cross-layer debugging.

Phase 4: staleness and drift.

- Compare `.dog` facts to repo reality.
- Flag missing files, moved routes, removed env vars, and unimplemented specs.
- Suggest tasks when implementation and spec diverge.
