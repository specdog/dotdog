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

## Research assessment

**Decision: the three-part architecture is a good fit; the candidate is not release-ready.** This is an engineering judgment from the existing code, primary sources and internal probes, not evidence of user demand or improved coding-agent success.

| Area | Useful role | 1.0 boundary |
| --- | --- | --- |
| Spec-driven upgrades | Preserve intended requirements and connect them to code/change evidence | Finish the existing import, validation, freshness and query workflows; do not replace the specification process |
| REA/Ghidra traversal | Navigate observed binary call relationships and their evidence | Import existing exports into the current graph/query tools; do not build another decompiler or treat missing edges as proof of independence |
| Type-driven module | Show selected type contracts and compiler diagnostics alongside affected code | One opt-in, explicitly versioned compiler adapter; no new language engine, mandatory hosted service or universal correctness claim |

The separation is deliberate. [Spec Kit's SDD description](https://github.com/github/spec-kit/blob/main/docs/concepts/sdd.md) puts intended behavior before implementation. [Ghidra's Function API](https://ghidra.re/ghidra_docs/api/ghidra/program/model/listing/Function.html#getCalledFunctions(ghidra.util.task.TaskMonitor)) supplies caller/callee relationships. [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking) can reject unhandled variants when an exhaustive contract is actually encoded. These sources support distinct capabilities, not automatic equivalence between a requirement, source type and recovered binary function.

Use one graph model and existing traversal commands, but retain each provider's identity, direction, provenance and coverage. Source symbols must not be joined to binary addresses by matching names. [SCIP](https://github.com/scip-code/scip/blob/main/docs/scip.md) is an existing reference for semantic symbol identities, signatures and relationships; it is not a new required backend for 1.0.

### Findings reproduced against `3da92fa`

- **Input boundary defects remain.** `validateWorkspaceConfig` throws for `repos: [null]` and a non-array `groups` object; it accepts a named group missing its `repos` array. Fix these existing boundary checks before adding another adapter. No schema-library dependency is justified solely by these findings.
- **Traversal needs clearer completeness semantics.** REA import retains partial coverage, and path/MCP top-level edges retain relationship evidence. However, path and neighborhood results omit graph-level coverage/limitations; `no_path` does not distinguish missing observed evidence from a complete negative result. MCP `traverse` also omits node-level origin/evidence when projecting nodes. Preserve that context in existing results rather than adding a parallel traversal engine.
- **The type prototype cannot be dropped into the installed compiler.** The candidate uses TypeScript `7.0.2`, whose loaded package has no legacy `createProgram` export. The research extractor uses the 5/6 API. Microsoft's [7.1 beta API announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) documents different sync/async clients and disposable snapshots. A diagnostic/repair smoke test passes, but a complete selected-symbol adapter has not been ported. Test the chosen adapter/version explicitly; do not require a beta compiler for all users.

Fresh internal research probes reproduced those gaps without changing production code. Separately, **21 selected-symbol/native-API research checks passed with zero failures or skips**. The earlier 108-test local candidate and successful CLI/MCP demo remain baseline evidence, not proof that these newly probed cases are correct. No new Ghidra analysis was run in this research pass.

### Smallest useful implementation

Repair the boundary and traversal-result gaps, then implement #333 around one explicit file/export, its selected type dependencies and compiler diagnostics under the project's actual configuration. Reuse existing graph import/context/impact. Keep spec-to-symbol links explicit and reviewed; do not infer requirement satisfaction from matching names or a compiler pass. [Project references](https://www.typescriptlang.org/docs/handbook/project-references.html) require appropriate build handling or an explicit unsupported result.

One internal change/invalid/repair workflow should show both rejection and recovery, including changed dependencies and incomplete evidence. Runtime inputs still need runtime validation: TypeScript explicitly does not aim for a [sound, provably correct type system or runtime type metadata](https://github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals). Developer productivity, token savings and agent-success improvements remain unproven for this combined workflow. None of these limits calls for a simulator, cloud service, graph database or separate product.
