# CLAUDE.md — dotdog

> You are an AI agent working on a dotdog project. This file is your ground truth.

## Before you do anything

1. Find the .dag file: `find . -name "*.dag" -not -path "*/node_modules/*"`
2. Load it. This is 94% smaller than the .dog source files. It has the full entity graph.
3. If MCP is available, run `npx dotdog serve` for live queries.

## Key rules

- Load the .dag before reading any code file. If you read code without the .dag, you are guessing.
- Do not grep for structure. The .dag has entity names, properties, relationships. Use it.
- If code contradicts .dag, .dag wins. Fix code toward .dag. Never fix .dag toward code.
- Run `dotdog validate` before committing. Score must not decrease.
- If the .dag says nothing about something, say "unverified." Do not speculate.

## Commands

| Command | When |
|---------|------|
| `dotdog validate` | Before committing spec changes |
| `dotdog compile` | After editing .dog files |
| `dotdog staleness` | Check spec/reality drift |
| `dotdog serve` | Start MCP for live queries |

## MCP tools

When `dotdog serve` is running: `getEntity`, `traverse`, `search`, `schema`, `summary`, `listProjects`.

## More

- [Agent instructions](https://specdog.github.io/agents) — full guide for AI agents
- [Spec-Driven Development](https://specdog.github.io/handbook) — methodology
