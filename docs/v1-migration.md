---
layout: default
title: Dotdog 1.0 migration
---

# Migrating to Dotdog 1.0

1.0 is being prepared on the modernization branch. Do not assume an npm tag, Homebrew formula or Spec Kit release asset exists until its release is published.

## Distribution

npm and Bun continue to install the same JavaScript package. Homebrew remains a separately maintained distribution. The Rust port in PR #330 is not part of this npm cutover. Node.js minimum is now explicitly 22.12.0; Bun 1.3+ remains supported.

## Rebuild generated identities

Run `dotdog refresh` after upgrading. Generated IDs now include a digest of the original identity components, preserving distinctions such as `A.ts` versus `a.ts`. Old compiled graph formats remain readable; regenerating them changes their generated IDs. Update any external references to generated IDs, or use graph labels for interactive queries.

Human-owned `.doghouse/semantic` and `.doghouse/overlays` inputs are preserved. Observed graph data, caches and refresh state belong under ignored `.doghouse` output paths. Decide explicitly which human-owned inputs your repository should track.

Compact spec graphs retain schemas, defaults, lifecycle and descriptions rather than discarding them to maximize a compression score. Different source files with incompatible declarations for the same entity use `Name@source-file` labels. Relationships resolve in their source file; an unresolved ambiguous relationship is an error, not an arbitrary link.

## Skills, hooks and CI

`dotdog skills install --agent both` installs repository-local Codex and Claude skills. It does not change global configuration or enable hooks. Edited skills are not overwritten; review them before updating.

`dotdog hooks install --agent git` installs a staged-index check. Existing hooks and custom hook-manager configuration are preserved by refusing replacement. A shared Git worktree hook outside the current repository boundary must be configured through the existing hook manager instead.

`dotdog hooks install --agent claude` adds a PostToolUse edit hook while retaining unrelated settings. This hook does not observe all shell or external-editor writes. Task-boundary refresh and independent CI checks are still necessary.

Use `dotdog hooks status` to inspect registration, and `dotdog hooks remove --agent git` or `claude` to remove Dotdog's hook contribution. Git hooks do not auto-stage generated graphs or human files.

Run a pinned Dotdog version and `dotdog check` in CI alongside application-specific tests. `check --staged` uses an isolated index snapshot; an unstaged edit does not change what it checks. These checks validate graph generation/integrity, not application behavior.

## Changed error behavior

- `init` refuses an existing project instead of overwriting its specs.
- Minimal scaffolds do not require a constitution file. Required-file presence is not reported as product completeness.
- An empty validation target returns nonzero.
- Unresolved `path --json` queries and high-severity `drift --json` results return nonzero, matching their failure data.
- `live --type endpoint --exit-code` fails when no endpoint is found, and an expected JSON body cannot pass on a non-JSON response.
- Recompile legacy v3 endpoint graphs: older compilers discarded endpoint type information, which cannot reliably be recovered from that graph alone.

`trace --depth` was removed because the old command ignored it. Use `context --depth` for an actually bounded multi-hop neighborhood.

## MCP and imports

MCP offers structured output plus text fallback, bounded context/impact queries, input validation, paging and standard protocol errors. Use an explicit project when several are available. `listProjects` reports invalid projects separately rather than serving their corrupt contents. Deleted graphs are evicted from the current server view.

Legacy initialization revisions and modern 2026-07-28 discovery/per-request metadata are supported. Modern clients must supply protocol version and client capabilities in `_meta`; unsupported versions are rejected. Local stdio remains the only server transport. Live infrastructure verification remains an explicit operation.

`graph import --format rea-callgraph` accepts a saved REA NativeCallGraph body. This is not a general-purpose Ghidra loader or REA Evidence-envelope parser. Evidence addresses, coverage and limitations are retained. A supplied binary SHA-256 scopes identities to that binary; otherwise the export digest scopes them and binary identity is unknown. Dotdog never invokes or reconfigures REA/Ghidra.

## Interpretation limits

Repository extraction covers inventory plus JS/TS top-level declarations and static relative imports/re-exports. Alias resolution, dynamic calls, whole-program behavior and non-JS/TS symbol extraction remain unverified. Git ignore rules are honored when a Git root is present. Scan/read errors fail rather than justify deleting an unseen suffix.

`analyze`, `simulate`, `staleness` and text-based `verify` remain heuristic helpers, not correctness proofs. Search is lexical TF-IDF, not an embedding model. Reported token figures use a byte-based estimate; savings vary and can be negative when retained metadata exceeds the source size.
