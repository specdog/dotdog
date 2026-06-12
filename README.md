# spec-platform

Monorepo for the Spec Platform — a knowledge graph system where specs ARE the database and LLMs ARE the query engine.

## The Flywheel

```
spec → validate → app → data → better spec → better app → ...
```

The spec describes the platform. The platform validates the spec. The validation report improves the spec. Each cycle adds granularity.

## Structure

```
spec-platform/
├── packages/
│   ├── spec-engine/     # Core types and ontology (shared by everything)
│   ├── spec-mcp/        # MCP Server — AI agents query specs via stdio
│   └── spec-cli/        # CLI — spec validate, init, simulate, list
├── projects/            # Spec genomes (dogfooding)
│   └── spec-platform/
│       └── specs/
│           ├── SPEC.md          # Product spec — screens, flows, stories
│           ├── constitution.md  # Immutable rules
│           └── data-model.md    # Graph ontology — nodes, edges, tasks, predictions, vectors
├── templates/           # Spec genome templates for new projects
└── package.json         # Bun workspace root
```

## Quick Start

```bash
bun install
cd projects/spec-platform/specs

# Validate our own spec (dogfood)
bun ../../../packages/spec-cli/src/index.ts validate ../..

# List projects
bun ../../../packages/spec-cli/src/index.ts list
```

## $0 Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Runtime | Bun | $0 |
| Database | bun:sqlite (embedded) | $0 |
| Types | TypeScript (strict) | $0 |
| CLI | Commander.js + chalk | $0 |
| MCP Server | @modelcontextprotocol/sdk (stdio) | $0 |
| Embeddings | all-MiniLM-L6-v2 (local) | $0 |
| Hosting | None needed (local-first) | $0 |

## The Spec Graph

The spec is not a document. It's a knowledge graph.

- **Nodes**: entities, tasks, predictions, screens, constraints, user stories
- **Edges**: contains, depends_on, implements, references, calls, precedes
- **Vectors**: every section embedded for semantic search, contradiction detection, staleness checks
- **Predictions**: forecasts with triggers, timeframes, confidence, and actual outcome tracking

LLMs traverse the graph at query time. They don't read prose and guess — they get exact typed values.

## Score

```
spec validate → 43% complete

  ✓ SPEC.md
  ✓ constitution.md
  ✓ data-model.md
  ⚠ COPY.md, DESIGN-SYSTEM.md, plan.md, INDEX.md
```
