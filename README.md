# dotdog

Local-first spec and code graphs for coding agents. Keep human intent, observed implementation, and imported analysis evidence distinct and queryable.

**1.0 development:** this branch prepares the next major release. The published npm `latest` version audited for this update was 0.9.0. No 1.0 release has been published by this change.

## Install

```sh
npm install -g dotdog
# or
bun add -g dotdog
```

Node.js 22.12+ or Bun 1.3+. npm and Bun install the same package. The existing Homebrew distribution remains available through the Specdog tap; its formula/version is maintained separately from this source change.

```sh
brew tap specdog/tap
brew install dotdog
```

## Existing repository: one refresh, targeted questions

```sh
cd your-repository
dotdog refresh --json
dotdog query "authentication"
dotdog context "file:src/auth.ts" --json
dotdog impact "file:src/auth.ts" --json
dotdog path "file:src/auth.ts" "file:src/session.ts" --json
```

Use an actual graph label from `query`, not the illustrative paths above. `refresh` maps repository files, extracts JS/TS declarations and static relative imports, preserves semantic/overlay layers, compiles specs when present, and reports added/changed/removed identities. `--if-stale` checks content hashes and skips extraction when inputs and output match. Unchanged JS/TS extraction is cached.

Generated repository graphs live under `.doghouse/`. Do not commit generated repository metadata by default. Human-owned semantic and overlay inputs remain separate from generated facts.

## Codex and Claude skills

```sh
dotdog skills install --agent both
# or: --agent codex / --agent claude
```

This installs the bundled `dotdog` skill into `.agents/skills/dotdog/` for Codex and `.claude/skills/dotdog/` for Claude Code. It is repository-scoped, idempotent, and refuses to replace user-edited skills. Invoke `$dotdog` in Codex or `/dotdog` in Claude; hosts can also select the skill when relevant. Installation does not modify global client settings or install hooks.

## Optional automation

| Layer | Responsibility |
| --- | --- |
| Skill | Choose useful graph context and verify cited evidence. |
| Claude edit hook | Refresh local graph artifacts after supported agent edits. |
| Git hook | Check a temporary snapshot of the staged Git index. |
| CI | Run a pinned version independently of editor behavior. |
| CLI/MCP | Stable execution and query interfaces beneath integrations. |

```sh
dotdog hooks install --agent claude
dotdog hooks install --agent git
dotdog hooks status
dotdog hooks remove --agent claude
dotdog hooks remove --agent git
```

Hooks are explicit opt-in, visible and removable. Existing Git hooks and `core.hooksPath` configurations are not overwritten. Git hooks never auto-stage files. Claude hooks preserve unrelated settings; edits made through shell commands or external tools may not trigger them. Use `refresh --if-stale` at the next task boundary and CI as independent checks.

For CI, install a pinned release or build this branch, then run:

```sh
dotdog check --json
```

`check` rebuilds graphs and checks structural integrity. It does not run application tests or prove runtime behavior. `check --staged` checks index contents rather than unstaged changes.

## New spec project

```sh
dotdog init my-project
# Fill in the generated human-owned specs.
dotdog validate
dotdog compile
dotdog design --json
dotdog serve
```

`init` refuses an existing project. `--minimal` creates two files and is supported by validation. Validation reports required-file presence and parser diagnostics, not a percentage of product correctness. Use `analyze` for heuristic suggestions; use real tests for behavior.

The compact compiler preserves property definitions, states and lifecycle metadata. Incompatible same-named declarations in different source files receive `Name@source-file` labels; relationships must resolve in their source scope. `--v2` retains legacy positional output. Byte-based token figures are estimates, not tokenizer measurements or quality guarantees.

## MCP

Configure a local stdio server with the installed `dotdog` executable and arguments `["serve"]`, from the intended repository root. It opens no TCP listener.

Tools: `listProjects`, `workspace.list`, `search`, `getEntity`, `schema`, `summary`, `traverse`, `path`, `context`, `impact`, and `infraVerify`.

Query an explicit project when more than one is loaded. Observed repository graphs use `<repository>:observed` names in MCP, keeping them separate from same-named spec projects. Every tool returns structured JSON plus text fallback. Search supports `limit` and `cursor`; traversal/impact/context are bounded and disclose truncation. Invalid graphs are reported separately by `listProjects`; deleted graphs are evicted.

The server supports legacy initialization revisions 2024-11-05, 2025-06-18 and 2025-11-25, plus 2026-07-28 discovery and per-request metadata. `infraVerify` is an explicit live network/provider operation; other graph queries stay local.

## REA / Ghidra evidence

Dotdog can import a saved **REA NativeCallGraph body**:

```sh
dotdog graph import native-calls.json --format rea-callgraph --project native --artifact-sha256 <binary-sha256>
dotdog context "0x1000" --dag .doghouse/imported/native.dag --json
dotdog graph export --dag .doghouse/imported/native.dag --format json
```

Replace the digest and address with actual evidence values. The importer retains traversal coverage, limitations, evidence references, addresses and the export digest. Without a binary digest, identifiers are scoped to the export bytes and binary identity remains unknown. Imported projects are also served by MCP. Imports create separate named graphs; automatic source-to-binary reconciliation and cross-project links are not provided.

This is an export adapter, not a direct Ghidra provider or a verified binary-analysis integration. REA/SolidState retains ownership of Ghidra, target selection, analysis sessions and authority. Dotdog never launches targets, installs REA/Ghidra, or registers another provider. NativeCallGraph bodies are supported; arbitrary REA Evidence envelopes and other Ghidra export formats are not implicitly accepted.

## Existing integrations

GitHub Spec Kit remains supported:

```sh
dotdog speckit import .
dotdog compile .doghouse/speckit
dotdog serve .doghouse/speckit
```

Workspaces retain `workspace init`, `add`, `list`, `validate`, `graph`, `observe`, `ask`, and `drift`. `refresh` operates on the current repository; it does not infer cross-repository calls. Use the workspace commands for explicit multi-repo manifests.

## Limits and migration

- AST extraction covers JS/TS top-level declarations and static relative imports/re-exports. It does not resolve arbitrary aliases, dynamic calls, runtime execution, or every language's semantics. Other files are inventoried.
- Git ignore rules are honored in Git repositories; non-Git directories use built-in exclusions. There is no silent 500-file cutoff.
- `impact` follows recorded relationships; it is not a complete runtime blast-radius proof.
- 1.0 uses content-derived, case-sensitive identities. Rebuild generated graphs with `refresh`; old graph formats remain readable. Do not persist old generated IDs as external contracts without migration.
- Missing paths and high-severity drift return nonzero exits, including JSON output.
- No fixed token-savings percentage or hallucination guarantee is claimed.

See [migration](docs/v1-migration.md), [audit and research](docs/npm-0.9-audit.md), and [integrations](docs/integrations.md). The independent Rust port remains in [PR #330](https://github.com/specdog/dotdog/pull/330); npm/Bun delivery is not being replaced by it.

## Development

```sh
bun install --frozen-lockfile
bun run lint
bun test
bun run build
bun run pack:check
bun run release:check
```

The release check packs the actual npm artifact and tests it outside the repository with Node and Bun. MIT licensed.
