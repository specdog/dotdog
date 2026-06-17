# AGENTS.md — dotdog

> This repo uses dotdog for structured specs. Read .dag for entity graph. Run MCP for live queries.

## Quick Start (read this first)

**Before any task**, load the spec graph:
- File: `projects/spec-platform/spec-platform.dag` (11 entities, 5 relationships, v2 positional format, ~740 tokens)
- MCP: `npx dotdog serve` (6 tools: getEntity, traverse, search, schema, summary, listProjects)

The .dag is 94% smaller than raw .dog files (v2 positional format). One file. All structure.

## Commands (when modifying specs)

```
dotdog validate     → check completeness (run before commits)
dotdog analyze      → gap detection + contradiction checking
dotdog compile      → rebuild .dag from .dog files
dotdog index        → build search index
dotdog search "q"   → semantic search across specs
dotdog staleness    → detect spec/reality drift
```

## Key Rules

1. Load .dag before writing code
2. Run `dotdog validate` before committing spec changes
3. Score must not decrease
4. Use conventional commits (feat:, fix:, docs:, chore:)
5. Never commit dist/ — .dag files are committed for agent efficiency
