# Changelog

## 1.0.0 — Unreleased

- Reuse MCP entity/adjacency indexes and compare content fingerprints without re-escaping graph text; retain reproducible lookup/token measurements and graph/vector/superposition research.
- Replace generated outputs atomically, preserve hard-linked evidence and serialize refresh/map/compile with recoverable ownership locks; handle CRLF input and add Windows CI.
- Verify and publish one hashed tarball; add a real SolidState/Ghidra → REA → Dotdog example with recorded provenance.

- Fix static symlink read/write escapes, forged hook ownership, parser hangs and unbounded MCP input; update SDK and vulnerable development dependency resolutions.
- Replace guessed provider MCP calls with explicit read-only APIs; parameterize Railway IDs, require Cloudflare account identity and disclose unverified Supabase tables.
- Compare nested endpoint contract values/types with bounded body reads and end-to-end timeouts; strict infrastructure checks fail on unverified results.
- Add read-only status, named scenario/reference diagnostics and advisory evidence/embodied coverage audits; deprecate misleading compatibility names and retire verify --init.
- Remove unused @spec packages, unwired scripts, scratch copies and invalid benchmark harness; replace the simulated demo with real CLI/MCP operations.
- Add dependency security CI, Bun/Actions Dependabot updates, extractor-aware cache invalidation and linear adjacency construction for high-fanout path queries.

- Add repository-scoped Codex and Claude skills, opt-in removable hooks and staged-index CI checks.
- Add content-hash refresh, cached JS/TS AST extraction, named context and reverse-impact queries.
- Unify legacy/current graph readers, preserve schemas and evidence, validate graph identity and references, and scope conflicting declarations by source.
- Harden MCP notifications, input validation, errors, paging and structured output; support modern discovery and legacy clients.
- Import saved REA NativeCallGraph bodies without launching or reconfiguring REA/Ghidra.
- Fix destructive init, minimal scaffolds, v3 token accounting, lexical search scoring, live endpoint detection and false-success exits.
- Replace nonfunctional linting with TypeScript checks; verify packed releases under Node and Bun and test CI on Node 22/24 and macOS/Linux.
- Breaking: generated graph IDs change; regenerate with refresh. Node.js minimum is 22.12.0. JSON errors now return nonzero where appropriate. No release published yet.

## 0.9.0 — 2026-07-18

- Add `dotdog speckit import` to convert GitHub Spec Kit features into local, queryable dotdog projects
- Track generated artifacts with SHA-256 hashes and preserve user edits by default
- Add explicit `--force` replacement, portable manifests, exclusive atomic writes, and project-boundary checks
- Quote imported Markdown and reject symlinked or protected source/output paths
- Include the package license and changelog in npm tarballs

## 0.8.13 — 2026-07-12

- Add bounded shortest-path queries through `dotdog path` and the MCP `path` tool
- Resolve exact and full-token endpoint matches before safe fuzzy fallback
- Return the connecting subgraph with confidence and safe origin metadata
- Add `dotdog design` for deterministic greenfield data-model audits

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
