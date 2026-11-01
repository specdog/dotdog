---
layout: default
title: Dotdog 1.0 release implementation and acceptance plan
---

# Dotdog 1.0 release implementation and acceptance plan

Scope narrowed by the maintainer: spec-driven design upgrades, REA/Ghidra graph traversal support, then a type-driven module. Keep the existing npm/Bun distribution and reuse the current graph, query and agent integrations. Do not introduce a new service or framework.

Internal demos verify these workflows; they are not new product features or user setup requirements. Simulation, sensors, robotics, embodied AI and provisioned cloud environments are not required for this scope. This replaces the earlier broader acceptance scope; it does not mark unrun checks as passed.

The 100-test hosted green candidate at `0569319` is a baseline, not completion. Every gate needs actual evidence against its named artifact/environment. No claim of absolute bug freedom, complete security or hardware safety follows from this plan.

## Ordered work and exit criteria

| Gate | Concrete implementation | Acceptance evidence |
| --- | --- | --- |
| Spec-driven design upgrades | Complete existing spec import, validation, code mapping, freshness, context and impact workflows | A local end-to-end spec/code change demonstrates useful queries and catches stale or invalid input |
| REA/Ghidra graph traversal | Import existing REA NativeCallGraph exports; reuse path, context, impact and MCP traversal with source identity and coverage limits | Internal demo imports the real Ghidra fixture, queries a known call relationship and checks missing/partial evidence; Dotdog does not own Ghidra analysis |
| Type-driven module | [#333](https://github.com/specdog/dotdog/issues/333): connect type contracts to the existing spec/code graph; distinguish compiler checks from runtime validation | Internal valid → invalid → repaired example, affected-node traversal and explicit unsupported/partial results; no new framework or required hosted service |
| Stable public contracts | Inventory every command/MCP tool, JSON shape, exit status, graph/profile version, deprecated alias and migration rule | Golden success/error fixtures; old supported graph formats load; invalid/ambiguous inputs fail explicitly |
| Filesystem and concurrency | Crash-safe generated writes; serialize conflicting refreshes; stale-lock recovery; preserve user-owned inputs and permissions | Interrupted write leaves old or new complete file; concurrent refresh cannot publish inconsistent state; static symlink attacks preserve outside files |
| Security sweep | Review parser/import boundaries, secret exposure, child processes, hook trust, dependency/runtime code, action permissions and publication authority | Reproduced findings with regressions; no unresolved known critical/high-impact release defects; advisory check plus manual boundary review |
| Cross-platform package | Linux/macOS/Windows Node execution, Bun installation/execution, paths with spaces/non-ASCII and command shims | Hosted OS matrix and clean packed-consumer installation of the same candidate bytes |
| Real agent workflows | Codex/Claude skill discovery, explicit invocation, edit refresh, staged checks and uninstall/edit preservation | Recorded host versions and actual actions/results; filesystem installation alone does not count |
| Performance and context | Verify bounded queries and token budgets; fix measured regressions in the scoped workflows | Reproducible measurements with omissions and limits; no vector/VSA backend or open-ended benchmark program |
| Command cleanup and polish | Retain useful commands, narrow misleading ones, remove genuinely purposeless code; complete help/examples/docs/error consistency | Purpose/consumer review, migration notes, executable examples and end-to-end failure behavior |
| Release integrity | Pack once, hash and test that tarball, retain verification manifest, publish only those bytes with provenance | Recorded artifact SHA-256/SHA-512, clean-consumer tests, trusted-publisher configuration verified, prerelease feedback resolved |

## Execution rules

1. Keep focused follow-up commits in the existing 1.0 branch/PR, linked to this acceptance plan. No main merge, tag or publication has been authorized by defining the scope.
2. For each finding record reproduction, effect, repair and rerun. Do not use test count as a quality target or remove a meaningful failing check to get green CI.
3. Preserve human-owned specs, unrelated hooks/settings and existing source data. Deprecated commands must identify the replacement and limits; no silent success for retired behavior.
4. Mark pending checks precisely. Claude CLI was not found on the current PATH. The Ghidra/REA/Dotdog macOS arm64 fixture has run successfully; see examples/native/verification.json. Earlier hosted checks and [retrieval measurements](retrieval-benchmarks.md) apply only to their recorded candidates. No cloud account or simulator is needed for the scoped internal demos. Existing live-provider behavior remains unverified without a real target; do not claim that mocks verify it.
5. Keep credentials, raw private exports and temporary demo artifacts out of public commits. Keep internal setup details out of product flows. Retain existing tested behavior unless a focused removal is justified; this scope correction is not a blanket code deletion.
6. Implement only the three scoped feature areas and necessary release fixes. Then run the complete release matrix, audit the candidate, resolve findings and request final release authorization. No merge, tag or publication before testing, audit and explicit approval.
