# Spec Platform — Constitution

## Core Principles

1. **The spec is the source of truth.** Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.
2. **The spec knows itself.** Every spec file tracks its own completion status, dependencies, and prediction accuracy. The spec IS the project manager.
3. **Vectors are first-class.** Spec content is embedded. Semantic search finds contradictions, stale sections, and related concepts across projects.
4. **Predictions get tested.** Every forecast has a trigger, timeframe, confidence, and measurement. When the trigger fires, the prediction is scored. Wrong predictions improve the model.
5. **Paths are computed, not guessed.** The optimal path to completion is calculated from task dependencies, velocity data, and constraint satisfaction. No human estimates — data only.
6. **Local-first, $0 MVP.** SQLite via bun:sqlite. MCP via stdio. No cloud dependency for core features. Cloud is for teams.
7. **The flywheel compounds.** spec → app → data → better spec → better app. Each cycle improves the model. Each wrong prediction makes the next one better.

## Tech Constraints

| Area | Constraint | Reason |
|------|-----------|--------|
| Runtime | Bun ≥ 1.3 | TypeScript-native, built-in SQLite, test runner. One tool. |
| Database | bun:sqlite (embedded) | Zero dependencies. Ships with Bun. Upgrades to Postgres for cloud. |
| MCP | stdio transport | $0 hosting. AI agents connect locally. |
| Embeddings | all-MiniLM-L6-v2 (local) or OpenAI text-embedding-3-small (cloud) | Local for MVP. Cloud for teams. |
| Language | TypeScript strict | One language across engine, MCP, CLI. No context switching. |
| Package manager | Bun (built-in) | No npm, no pnpm, no yarn. One install. |

## Governance

- The spec files in `projects/spec-platform/specs/` define this product.
- Every PR must update specs before code.
- `spec validate` must pass before merge.
- Predictions are reviewed at project milestones. Wrong predictions are not failures — they are data.
