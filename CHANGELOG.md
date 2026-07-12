# Changelog

## 0.8.12 — unreleased

- Add bounded shortest-path queries through `dotdog path` and the MCP `path` tool
- Resolve exact and full-token endpoint matches before safe fuzzy fallback
- Return the connecting subgraph with confidence and safe origin metadata

## 0.8.11 — 2026-07-12

- Keep generated `.doghouse` graph artifacts out of Git by default
- Return portable relative paths from workspace CLI, graph, and MCP output while retaining `cwd` as a compatibility alias
- Limit stdio MCP child processes to an explicit minimal environment
- Remove the unused generic workspace process runner

## 0.8.10 — 2026-06-27

- Add `dotdog audit <dag...>` for format-agnostic DAG readability checks
- Support `--require-kind` and `--json` for CI-friendly graph assertions

## 0.8.8 — 2026-06-21

- Publish repo-world CLI surface with `map`, `query`, and `trace`
- Add smoke coverage for repository mapping and world-model lookup
- Keep generated repo maps advisory in project analysis

## 0.8.5 — 2026-06-18

- Add `dotdog live` command — endpoint contract testing with backup failover
- Add EndpointNode type to grammar and parser
- Add live-endpoint-testing docs page and blog post

## 0.6.0 — 2026-06-17

- Add DAO governance kit template
- Add community kit contribution guide
- Add lint script (`bun run --check src/`)

## 0.5.2 — 2026-06-17

- Fix parser hang on plain fenced code blocks in `.dog` prose
- Add `kit init` coverage for built-in kits
- Add missing SaaS kit constitution so generated kit projects validate

## 0.5.1 — 2026-06-17

- Fix predictions parser: accept container format (### Predictions / ##### name) and any heading level (###/####/#####)
- Fix resolve command: find predictions regardless of heading format
- Same heading-level fix applied to Entity, Relationship, Event blocks
- Add CLAUDE.md as agent entry point (adopted by TypeScript, React, Jest)
- Rewrite dotdog landing page as marketing page with real dogfood output
- Full 18-command reference in README (tokens, index, search, predictions, resolve, kit, woof)
- Add back-nav to all docs subpages and blog
- CI version-check: enforce semver bumps on PRs touching src/
- CONTRIBUTING.md: document versioning rules and release checklist
- Add AI agents reference to specdog.github.io homepage

## 0.5.0 — 2026-06-17

- verify command: auto-generate spec-code mappings, detect drift
- kit list command: show available templates
- MCP entity name lookup: support dashed names, schema, traverse tools
- SaaS and e-commerce kits
- Adoption guide by @WilliamK112
- 20 labels, improved templates, injection scanner

## 0.4.1 — 2026-06-16

- Expanded docs: tutorial, FAQ, integrations, use cases
- Improved issue templates and labels
- Added dotdefi badge and kit repos

## 0.4.0 — 2026-06-16

- .dag v2 positional format (94% token savings)
- Validate .dog output after mutations
- Reject unknown relationship targets at compile
- Backward compat tests, serve test
- 14 tests (up from 11)

## 0.3.6 — 2026-06-15

- Fixed hardcoded test paths
- Resolve command colon preservation

## 0.1.0 — 2026-06-12

Initial release.
