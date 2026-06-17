# AGENTS.md — dotdog

> This repo is the dotdog CLI tool. For spec graphs, use `npx dotdog serve` (MCP) or `dotdog compile`.

## Quick Start (read this first)

**MCP**: `npx dotdog serve` (6 tools: getEntity, traverse, search, schema, summary, listProjects)

## Commands (when modifying dotdog source)

```
dotdog validate     → check completeness (run before commits)
dotdog analyze      → gap detection + contradiction checking
dotdog compile      → rebuild .dag from .dog files
dotdog index        → build search index
dotdog search "q"   → semantic search across specs
dotdog staleness    → detect spec/reality drift
```

## Key Rules

1. Use conventional commits (feat:, fix:, docs:, chore:)
2. Never commit dist/
3. Every code change touching `packages/dotdog/src/` or `package.json` must bump version
4. Dogfood: test against `npx dotdog@latest validate` before shipping
