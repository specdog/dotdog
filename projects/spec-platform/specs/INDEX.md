# Spec Platform — INDEX

> Reading paths for humans, developers, and AI agents.

## Who reads what first

| You are... | Start here | Then... |
|------------|-----------|---------|
| New team member | SPEC.md (5 min) | constitution.md → plan.md |
| Developer | SPEC.md | data-model.md → plan.md |
| AI agent | data-model.md | COPY.md → DESIGN-SYSTEM.md → SPEC.md |
| Designer | DESIGN-SYSTEM.md | SPEC.md → COPY.md |
| Investor / stakeholder | SPEC.md | plan.md |

## Human reading path (5 min)

```
SPEC.md              ← What does it do? Screens, flows, stories.
constitution.md      ← Immutable rules. What can't change.
plan.md              ← Execution phases. What's next.
```

## AI agent reading path

```
data-model.md        ← Exact types. Graph ontology. Query patterns.
COPY.md              ← Every string. Every state. No guessing.
DESIGN-SYSTEM.md     ← Every token. Every component. Every screen layout.
SPEC.md              ← Product context. User stories. Success criteria.
constitution.md      ← Constraints to enforce.
plan.md              ← What to build next.
```

## Execution path

```
INDEX.md (here)
  → SPEC.md              Product, screens, flows
  → constitution.md      Rules, constraints, governance
  → data-model.md        Entities, relationships, vectors, predictions
  → COPY.md              Every UI string
  → DESIGN-SYSTEM.md     Tokens → primitives → components → patterns → screens
  → plan.md              Phases 0-6, repo layout, verification steps
```

## Spec Genome Files

| File | Status | Purpose |
|------|--------|---------|
| SPEC.md | ✓ | Product spec — screens, flows, user stories |
| constitution.md | ✓ | Immutable rules — 7 principles |
| data-model.md | ✓ | Graph ontology — 5 entities, relationships, queries |
| COPY.md | ✓ | Every CLI string — every state |
| DESIGN-SYSTEM.md | ✓ | Terminal tokens — colors, icons, layout |
| plan.md | ✓ | Execution phases 0-6 |
| INDEX.md | ✓ | This file — reading paths |

## Key paths for developers

```
packages/spec-engine/src/index.ts    ← Core types, parser, graph traversal
packages/spec-cli/src/validate.ts    ← Validation checks, scoring
packages/spec-cli/src/init.ts        ← Project scaffolding
packages/spec-cli/src/list.ts        ← Project listing
packages/spec-mcp/src/index.ts       ← MCP server (AI agent interface)
```

## Score

Current: 100% (all required + optional files present)
