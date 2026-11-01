---
layout: default
title: Dotdog 1.0 security and release review
---

# Dotdog 1.0 security and release review

Reviewed 2026-11-01 for the first 1.0.0 npm/Bun release. Scope: CLI registrations/aliases, saved graph formats and MCP consumers, spec import/checks, repository/workspace boundaries, generated writes/locks, optional compiler execution, hooks, provider dispatch and package publishing. This is a source review with regressions and integration checks, not an independent penetration test or a guarantee of bug freedom.

## Findings and dispositions

Code paths below are relative to `packages/dotdog/src/`.

| Boundary | Finding and disposition | Verification |
| --- | --- | --- |
| Filesystem writes/inventory | **Fixed:** static symlink escapes, dangling output symlinks, redirected Git inventory and hard-link truncation. Generated replacement uses fsync and atomic rename; cooperating graph writers have ownership locks and dead-process recovery. | `security.test.ts`, `writes.test.ts`; external fixture bytes remain unchanged; concurrent writers fail explicitly. |
| Parsing/spec checks | **Fixed:** parser non-progress on step/table lines, graph reads bypassing the size guard and ambiguous reference labels passing checks. Exact IDs take precedence. | Parser/security/release-audit regressions; ambiguous and oversized inputs fail without changing authored plans. |
| Workspace input | **Fixed:** malformed nested JSON reached unchecked typed data. Shape/reference checks precede registry construction; only successful parser results expose typed data. | Nested-input cases and real strict/exact-optional compiler checks in `workspace.test.ts`. |
| Graph/query contracts | **Fixed:** arbitrary-node matches for punctuation/Unicode, ambiguous duplicate labels, omitted-candidate flags, lost node provenance and scope-free token errors. Ambiguity candidates use exact IDs and disclose truncation. | Independent distance oracle, context token vectors/budgets, changed/deleted/corrupt graph cases and CLI/MCP schema regressions. |
| MCP transport | **Fixed:** unbounded line buffering. Local stdio handles requests sequentially, enforces a 1 MiB line cap and output backpressure, and validates tool arguments. | Real SDK stdio discovery/invocation; all eleven tool contracts and legacy/modern protocol cases. |
| REA import | **Fixed:** bare exports omitted producer direction and could reverse caller meaning. Require the declared direction; retain binary/export identity, coverage and evidence. | Fresh SolidState-owned Ghidra forward/backward fixture checks; both one-hop paths pass, binary digest unchanged, target never executed. |
| Optional types | **Reviewed:** exact TypeScript 7.0.2 project compiler, original options/diagnostics, no emit/build writes, bounded Node worker and process-tree cleanup. Saved evidence survives generic import/MCP. | Valid → TS2322 → repaired, inherited JSONC/aliases, repeated names, overloads/unions, Unicode, limits, unsupported inputs and timeout/child cleanup. Coverage remains partial. |
| Skills/hooks | **Fixed:** forged ownership could remove unrelated files; malformed Claude settings could falsely report installation. Validate owned targets and mutation shape; preserve edited skills/hooks and unrelated settings. | Pre-repair failures then passing regressions; idempotence, staged-index checks and actual-host discovery/removal checks. |
| Live/provider operations | **Fixed:** guessed remote MCP dispatch, literal provider identifiers, interpolated GraphQL, ignored filters and false endpoint passes. Use fixed origins/variables, reject redirects, bound response bodies/timeouts and fail strict checks on unverified results. | Request/response regressions in `providers.test.ts` and endpoint contract tests. Live account/resource permissions are not established by mocked requests. |
| Release integrity | **Strengthened:** require tag/version agreement and a main-history commit; manifest records source commit, file list and archive hashes. Publisher refuses mismatched source commits or tampered bytes and publishes the checked archive with provenance. | Negative commit/digest regressions, clean-consumer checks and workflow review. Registry authorization/provenance still require the actual publishing result. |
| Bloat/compatibility | **Removed:** unused legacy `@spec/*` packages, unwired keyword/MCP code, scratch parser copies, obsolete scripts and invalid historical-log benchmark machinery. Retain supported aliases with explicit limitations. Share existing parser chunks rather than duplicate bundled code. | Caller/package inventory, command/legacy-format regressions and package allowlist. No mandatory runtime npm dependency or service was added. |

## Verification record

The full local candidate suite passes **133 tests, 2,102 assertions and one snapshot**, plus lint, validate/doctor, frozen dependency installation and package checks. The [release review PR](https://github.com/specdog/dotdog/pull/340) tracks current-head Linux Node 22/24/26, macOS/Windows Node 24 and Bun 1.3.14/1.4.4 checks, Spec Kit compatibility and final artifact evidence. Historical checkpoints are not relabeled as results for new bytes.

Actual Codex app-server checks cover project skill discovery, command invocation, edit refresh, protected agent configuration and fixture-owner removal discovery. Actual Claude Code checks cover skill discovery, stdio MCP connection, hook removal, unrelated-settings preservation and skill removal discovery. Model-driven Claude invocation/edit refresh remains unverified; deterministic host checks are not a model-output evaluation.

The published 0.9.0 package also passed the required validation dogfood check. Its registry metadata contains provenance, but that does not prove authorization for a future release. No local package test constitutes npm publication.

## Dependencies and licenses

`bun audit --json` returned `{}` for the frozen candidate dependencies. This is an advisory snapshot, not malware detection or proof of complete safety. SDK 1.32.2 and patched transitive resolutions are development/test dependencies, not a hosted runtime service.

Bundled Babel parser, Commander, Chalk and gpt-tokenizer/o200k_base license notices ship in `THIRD_PARTY_NOTICES.md`. The project compiler is consumer-installed and not bundled. Package inspection excludes node_modules, tests, private state and raw test evidence. Two unused imports were removed without changing emitted bundle bytes.

## Accepted limitations

- Saved graphs describe supplied/observed facts, not requirement satisfaction, complete semantic closure or every runtime effect. Missing edges and bounded negative searches do not prove independence.
- Graph input/normalization, context, MCP and compiler bounds are finite processing limits, not global peak-memory or CPU guarantees. [Measured performance](path-performance.md) distinguishes fixtures, startup, output bytes and OS-reported memory from general speed claims.
- Static path guards and atomic replacement are not race-free multi-user filesystem isolation. Malformed/foreign-host writer locks require inspection rather than guessed ownership.
- Source/config/compiler identity is not authenticity. TypeScript configuration can weaken checks; trusted project compiler code is executable. Re-inspect after project/compiler/dependency changes; saved audits cannot discover new or unloaded files.
- Credential exclusions/redaction are best-effort. Source, signatures, filenames, authored text and arbitrary graph properties can contain sensitive data; review exports before sharing. Imported strings are data, never permission or agent instructions.
- Live endpoint checks intentionally contact reviewed spec-defined URLs, including local endpoints. Real cloud accounts, provider permissions/rate limits and all client/model versions are not covered by fixture tests. They are not prerequisites for local spec/REA/type graph workflows.
- The existing optional evidence profile does not add a simulator, device operation or cloud prerequisite. It does not discover omitted physical hazards, establish measurement quality or authorize actuation.
- Feature review, publication authorization and successful registry deployment are separate. Final source/artifact/provenance and post-publication install results remain authoritative; never infer deployment from a green build.

See [migration](v1-migration.md), [release gates](v1-release-plan.md) and [native fixture](../examples/native/README.md).
