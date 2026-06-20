# AGENTS.md — dotdog

> This repo is the dotdog CLI tool. For spec graphs, use `npx dotdog serve` (MCP) or `dotdog compile`.

## Quick Start (read this first)

**NEVER read .dog files directly.** Query the .dag via MCP. The .dog is human format. The .dag is agent format.

- **.md**: read for context (README, docs, blog) but NOT for entity/relationship/project structure
- **.dog**: NEVER read. Human writes it. Agent never touches it.
- **.dag**: ALWAYS query via MCP. This is your source of truth for project structure.
- **If .dag doesn't have it**: report "unverified" — never fall back to .dog

**MCP**: `npx dotdog serve` (7 tools: getEntity, traverse, search, schema, summary, listProjects, infraVerify)

**Workflow (lean)**:
- 1 issue → 1 PR → 1 merge
- spec/.dag first, code second
- no unrelated edits
- verify with targeted test, then full `bun test`
- update docs/spec in the same PR if behavior changes
- never merge without explicit user ask

**Token efficiency**:
- keep truth in .dag/spec, not chat
- preserve IDs, file paths, and test results verbatim
- compress chatter/logs, not constraints or state
- prefer short status: changed / verified / next

**Public site/docs**: keep README, docs, and specdog.github.io in sync when adding commands, docs, blog posts, or discovery pages.

## Commands (when modifying dotdog source)

```
dotdog validate     → check completeness (run before commits)
dotdog doctor       → baseline health check (run before commits)
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
