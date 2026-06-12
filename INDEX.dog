# INDEX

## What is this?

A monorepo for the Spec Platform. The spec IS the database. The LLM IS the query engine.

## Reading Paths

| You are... | Start here |
|------------|-----------|
| New developer | [README.md](README.md) → `projects/spec-platform/specs/SPEC.md` |
| AI agent | `projects/spec-platform/specs/data-model.md` — the graph ontology |
| Want the templates | [templates/](templates/) — copy into your project |
| Want to run it | `bun packages/spec-cli/src/index.ts validate .` |

## Repo Map

```
spec-platform/
├── packages/
│   ├── spec-engine/src/     → types/index.ts         (core ontology types)
│   ├── spec-mcp/src/        → index.ts               (MCP server — AI agents query specs)
│   └── spec-cli/src/        → index.ts, validate.ts  (CLI — spec validate, init, list)
├── projects/spec-platform/specs/
│   ├── SPEC.md              → product spec (screens, flows, stories)
│   ├── constitution.md      → immutable rules
│   └── data-model.md        → graph ontology (nodes, edges, vectors, predictions)
├── templates/               → spec genome templates
└── plan-digital-twin.md     → roadmap (predictive layer, simulation engine)
```

## Flywheel

```
spec → validate → app → data → better spec → better app
```

Current score: 43% (SPEC.md ✓, constitution.md ✓, data-model.md ✓, missing COPY.md, DESIGN-SYSTEM.md, plan.md)

Next: COPY.md + DESIGN-SYSTEM.md → 71%
