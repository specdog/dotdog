---
layout: default
title: Dotdog 1.0 release plan
---

# Dotdog 1.0 implementation and release plan

## Scope

Keep one npm/Bun package and the existing graph/query architecture:

1. **Spec-driven design:** spec import, validation, source mapping, freshness, context and impact.
2. **REA/Ghidra traversal:** import saved NativeCallGraph exports and query their observed relationships. SolidState/REA owns analysis; Dotdog does not run another decompiler.
3. **Type-driven module:** selected type contracts, dependencies and compiler diagnostics, tracked in [#333](https://github.com/specdog/dotdog/issues/333).

Specs describe intended behavior. Types constrain representable code states and interfaces. Graphs connect artifacts and their evidence; they do not prove requirement satisfaction. Typechecking does not validate untrusted runtime input, and an absent observed edge does not prove independence.

No separate tool, new service, graph backend, mandatory beta compiler, simulator, robotics stack or provisioned-cloud prerequisite. Verification fixtures are test infrastructure, not product setup requirements. Keep the Rust port separate from this npm release.

## Delivery order and tickets

| Order | Work | Tracking | Reviewable result |
| --- | --- | --- | --- |
| 1 | Finish spec/REA foundations and contributor guidance | [#331](https://github.com/specdog/dotdog/issues/331), [PR #332](https://github.com/specdog/dotdog/pull/332) | Existing implementation, regressions, migration/docs and runtime matrix |
| 2 | Audit code/security boundaries and remove proved bloat | [#334](https://github.com/specdog/dotdog/issues/334) | Focused cleanup/fix PR with findings and compatibility evidence |
| 3 | Implement the bounded type module | [#333](https://github.com/specdog/dotdog/issues/333) | Compiler adapter, graph integration, diagnostics and negative tests |
| 4 | Profile and optimize the completed workflows | [#335](https://github.com/specdog/dotdog/issues/335) | Comparable before/after measurements and justified optimizations |
| 5 | Run actual-host acceptance and final release audit | [#336](https://github.com/specdog/dotdog/issues/336) | Final candidate evidence, artifact manifest and resolved findings |
| 6 | Release the approved candidate | #336 | Explicit approval, approved main commit, specific tag and verified npm artifact |

Use one issue per focused PR. Branch dependent work from its reviewed predecessor when necessary; do not merge merely to unblock development. Open implementation PRs when code exists to review, not empty placeholders. Required testing/audit and explicit approval precede merging, tagging or publishing.

## 1. Finish spec and REA foundations

Code paths below are relative to `packages/dotdog/src/`.

- Review `spec/checks.ts`, `spec/contracts.ts`, `map/source.ts`, `map/repoMapper.ts`, `workspace/` and graph consumers as one flow: authored spec → compiled graph → explicit source/check mapping → refresh → context/impact.
- Preserve authored specs and user settings. Reject missing/ambiguous mappings and malformed input. Keep lexical-reference checks labelled lexical; comments or matching names are not semantic verification.
- Preserve intended versus observed facts, stable identities, origins, coverage, limitations and freshness. Source edits must invalidate stale observations; ambiguous names must not silently select another entity.
- Review `graph/commands.ts`, `graph/model.ts`, `graph/path.ts`, `graph/io.ts` and `serve.ts` for consistent CLI/MCP behavior. REA imports require producer direction and binary/export identity; backward rows must still become caller → callee edges.
- Exercise loops, disconnected graphs, external/unresolved calls, duplicate function names, malformed exports and depth/hop limits. Keep truncated search and missing-edge results distinct from proof of no dependency.

**Exit:** internal spec/code changes and both native-export directions exercise validation, refresh, traversal, context and impact. Supported legacy graphs, CLI aliases/exits and existing MCP contracts retain documented behavior. No binary execution is needed.

## 2. Audit and remove justified bloat

- Inventory shipped commands, exports, hooks, integrations, package files and dependency consumers before deletion. Text search or missing tests do not prove a public path is unused.
- Trace parsing, normalization, path/symlink containment, atomic writes/locks, hooks, subprocesses and providers. Review malformed/oversized data, stale caches, failure cleanup, credentials and accidental success on partial failure.
- Reproduce actionable defects, add failing regressions, then make the smallest shared-cause fix. Remove proved dead branches/dependencies and duplicate logic without a wholesale rewrite or speculative abstraction.
- Review bundled dependencies and third-party notices, not only declared runtime dependencies. Preserve supported recovery paths and migration aliases unless removal is explicitly documented.
- Record findings with source locations, impact, repair, checks and residual limitations. Revisit affected boundaries after type integration and optimization.

**Exit:** no unresolved high-impact release defects; targeted and full checks pass. State exactly what was removed and why. Fewer lines, a clean advisory scan or a clean Git tree do not establish complete correctness.

## 3. Build the type-driven module

### Compiler boundary

- Use one module under `types/`, connected through `cli.ts` and existing graph modules. Resolve the consumer project's installed compiler; never auto-install one.
- The 7.0.2 package exposes `typescript/unstable/sync`. The implemented adapter uses its configured snapshot/checker in a bounded Node worker, not the incompatible legacy `createProgram` prototype or a mandatory 7.1 beta compiler. Support is explicitly version-specific.
- Surface: `dotdog types inspect <export> --file <path> --project <tsconfig> --json`. Import successful saved results through existing graph machinery. MCP queries do not launch compilers.
- Preserve original project options and cached input bytes; do not emit declarations, edit configuration or write project build output. JSONC, inherited options, aliases and re-exports have integration coverage. Omitted checking options remain unspecified rather than being falsely reported as disabled.
- The earlier declaration-emission probe exposed `declarationDir` and `stripInternal` risks. The native read-only adapter avoids that emit path; it does not claim all configurations are supported. Reference/composite builds and `noCheck` remain unsupported.
- Use fixed worker arguments, no shell, bounded inputs/output/time and process-tree cleanup. Retain compiler/config/input identities on graph-node evidence so generic import and MCP retrieval cannot discard them. Keep saved paths repository-relative and raw absolute-path diagnostic output out of artifacts.

### Contracts and graph integration

- Use the configured compiler checker and source declaration handles for selected signatures, tagged unions and bounded type references. Exclude implementation bodies; this is not complete semantic dependency closure.
- Resolve supported local aliases/re-exports to file-qualified identities. For external types, overloads, generics, declaration merging or computed types, preserve supported contracts faithfully or report limitations. Matching names are not symbol identity.
- Reuse normalization, evidence, coverage, context and impact. Keep compiler diagnostics separate from graph completeness: failed compilation, partial graph and successful check are different states.
- Keep spec → source/type/check links explicit and reviewable. Do not join binary/source symbols automatically by name or treat compatibility as requirement proof.
- Reuse runtime input validation. No schema framework, second graph index, language-plugin ecosystem or mandatory runtime npm dependency is planned.

**Exit:** production integration resolves a selected re-exported contract, accepts valid code, rejects an invalid transition with the real diagnostic, detects an imported contract change, reports affected nodes and passes after repair. Cover repeated names, missing symbols/compiler, unsupported version/configuration, malformed runtime input, partial dependencies, timeouts, stale inputs and cleanup. The candidate now exercises these paths; see [type contracts](type-contracts.md). Broader compiler/version support needs separate evidence, not scope expansion.

## 4. Measure, then optimize

Extend `scripts/benchmark-retrieval.ts` and `scripts/benchmark-repositories.ts`; do not add a benchmark framework. Pin baseline/candidate commits, runtime, corpus revisions, task labels, graph limits and cache state. Capture the pre-cleanup baseline before changing runtime code.

Measure CLI startup, cold/warm refresh, single-file edits, context, impact, path/MCP queries and type inspection. Record p50/p95 latency, peak RSS, serialized bytes and packed size. The current retrieval harness reports a post-retrieval RSS snapshot, not peak memory; add isolated measurement where needed. Use repeated comparable runs, at least 20 measured retrieval samples, and report variance.

Profile first. Reduce repeated parsing/index construction, duplicated traversal or unnecessary serialization only when measurements justify it. Test caches against changed/deleted/replaced files and configuration changes. Compare returned facts, evidence, limits and errors before speed. Include cyclic/high-fan-out graphs and fixed public repository tasks; keep private inputs and machine-specific logs local.

**Exit:** sanitized before/after report, unchanged correctness and documented tradeoffs. No unexplained material regression. No arbitrary percentage/line-count target, unsafe cache or dropped provenance to improve a metric.

The focused [path-search comparison](path-performance.md) measures parent-link BFS and zero-hop handling against `d94a8f4`, with matching result hashes and a reverse-order replay. It does not complete the other workflow measurements in #335.

## 5. Verify the completed candidate

| Area | Release requirement |
| --- | --- |
| Spec/code workflows | A reproducible spec/code change exercises validation, refresh, context and impact; stale, invalid and ambiguous input fails explicitly. |
| REA/Ghidra | Forward and backward exports retain caller → callee meaning, binary/export identity, coverage and limitations. Require the producer direction; missing evidence is not proof of independence. |
| Types | One bounded, opt-in adapter uses an explicitly supported compiler/configuration. A valid → invalid → repaired example demonstrates real diagnostics and affected-node traversal. Unsupported versions, missing symbols and partial dependencies remain explicit. |
| Compatibility | Supported graph formats, CLI exits, JSON/MCP contracts and removable integrations pass regression checks. User-owned specs/settings are preserved. |
| Security | Parser, filesystem, child-process, hook and provider boundaries are reviewed; reproduced findings have regressions. No unresolved high-impact release defects. Advisory scans supplement manual review. |
| Runtimes | Linux/macOS/Windows CI passes; clean consumers exercise the packaged CLI on supported Node/Bun runtimes, including the declared Node minimum. |
| Agent integrations | Actual-host skill/MCP discovery and removal, CLI command/refresh behavior and settings preservation are verified; installed files alone are insufficient. Model-driven behavior studies are separate from local CLI/MCP release contracts. |
| Documentation | Stable installation and development-candidate instructions are distinct. Commands, migration notes, package/extension versions and supported limitations agree. |
| Release integrity | Approve the final commit; pack once, retain hashes, test those bytes, resolve prerelease findings and publish only the verified archive with provenance. |

## Implementation status

The completed candidate combines the [spec/REA foundation](https://github.com/specdog/dotdog/pull/332), [spec-check boundaries](https://github.com/specdog/dotdog/pull/337), [path optimization](https://github.com/specdog/dotdog/pull/338), [bounded type module](https://github.com/specdog/dotdog/pull/339) and [final boundary review](https://github.com/specdog/dotdog/pull/340). The full local suite passes 133 tests/2,124 assertions. Hosted checks cover Linux Node 22/24/26, macOS/Windows Node 24, Bun 1.3.14/1.4.4 and pinned Spec Kit 0.12.0/1.2.5. Each changed head must pass its own checks.

Fresh forward/backward Ghidra fixture checks preserve the target digest without executing it. Actual Codex app-server checks exercise discovery, command execution, edit refresh and removal discovery; actual Claude Code checks exercise skill/MCP discovery, settings preservation and removal. A model-driven Claude invocation/edit-refresh run remains unverified. Internal driver/state/log files stay outside the public package.

The [type research](https://github.com/specdog/specdog.github.io/pull/66) preserves its separate 62-check checkpoint and historical compiler probes. The production candidate uses the tested 7.0.2 interface, not the incompatible 5/6 extractor or a required beta compiler. Reference builds remain unsupported; compiler success is not requirement proof. [Source-review dispositions](v1-security-audit.md), [measured workflow comparison](path-performance.md), [migration](v1-migration.md) and the [native fixture](../examples/native/README.md) retain the implementation evidence and limitations.

Freeze features before final review. Reconcile findings against the complete release diff. A failed or skipped required gate is not a release pass. Do not hide failures by reducing coverage or replacing real integrations with mocks. A SolidState wrapper pass establishes only what its underlying check exercised.

## Outstanding launch gates

- Reconcile current-head cross-platform/package results with the completed source review; broader compiler/reference or semantic/VSA research is not a 1.0 prerequisite.
- Retain the model-driven Claude limitation explicitly; actual host discovery/removal and deterministic CLI/MCP contracts, not a paid model account or model-output study, are the scoped integration gates.
- Freeze the final candidate, verify minimum-runtime/package behavior and resolve prerelease feedback.
- Verify npm trusted-publisher configuration and obtain release approval. Tests of the publishing script do not verify registry permissions.

The release remains unmerged and unpublished until these gates are complete. Existing live-provider behavior requires real-target evidence before making live-integration claims; it is not a cloud-provisioning prerequisite for the scoped graph workflows.

Historical declaration-emission probes are distinct from the implemented read-only native adapter and from final archived package bytes. Runtime/host and performance checks establish only their stated cases, not complete correctness or end-to-end model productivity.

## 6. Release integrity and approval

The first release target is `1.0.0`. Keep that version across unshipped development commits and align package, extension, lockfile and changelog metadata. Local package checks do not publish to npm. After required gates pass, approve the final commit and artifact. Do not commit build output.

Pack the final candidate once, retain commit/version/file manifest/digests, test those exact bytes and publish only that archive. Changed candidate bytes invalidate the previous artifact approval. Resolve approved prerelease feedback before stable publication; prerelease publication also requires approval.

The existing workflow uses a GitHub-hosted Node 24 runner, `id-token: write`, a version-matching tag whose commit is on `main`, and the verified tarball. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires npm >= 11.5.1 and Node >= 22.14.0; its package configuration must match the repository/workflow and permit the chosen publishing action. Do not assume a newly configured publisher permits direct publishing. [Provenance](https://docs.npmjs.com/generating-provenance-statements/) also requires matching public repository metadata. These publishing requirements are separate from the package's runtime minimum.

After testing/review and explicit approval, merge, tag the approved main commit and push only that specific tag. Verify the installed version/provenance and run an isolated post-publication smoke check before marking release complete. If defective, deprecate the affected version and issue a tested patch; never overwrite an npm version.

## Contribution boundaries

Keep changes focused and record reproduction, repair and verification for findings. Preserve human-owned specs and unrelated settings. Keep personal information, credentials, conversation records and raw private evidence out of public artifacts; publish only necessary documentation and sanitized technical evidence. No claim of bug freedom, complete security or physical safety follows from this plan.
