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

- Add one module under `types/`, connected through `cli.ts` and existing graph modules. Resolve the consumer project's installed TypeScript compiler explicitly; never auto-install one.
- Start with the tested 7.0.2 CLI capability, not the incompatible legacy `createProgram` prototype or a mandatory 7.1 beta API. Declare supported versions/configurations only after adapter tests pass.
- Proposed surface: `dotdog types inspect <export> --file <path> --project <tsconfig> --json`. Confirm its result/exit contract before implementation; this command does not exist yet. Import saved results through existing graph machinery. MCP queries must not implicitly launch compilers.
- Run diagnostics with original semantic options. A separate declaration-inspection pass may change only necessary emit/output settings; direct all output/build metadata into managed temporary storage. Never loosen strictness or silently replace project configuration.
- Explicitly contain `declarationDir` as well as `outDir`; an original declaration directory otherwise overrides the temporary output location. Record inspection-only option differences. With `stripInternal`, declarations may omit contracts still referenced by public signatures: retain them through an explicit inspection override or report the missing dependency, never silently claim completeness. See the [TypeScript emit options](https://www.typescriptlang.org/tsconfig/#declarationDir).
- Initially reject unproved configurations such as project-reference/composite/outFile builds. Test extends/path aliases and re-exports explicitly; unresolved dependencies remain partial rather than guessed.
- Use fixed subprocess arguments, no shell, bounded time/output and cancellation/cleanup. Record compiler version, configuration identity, source digests and scope. Detect changes during inspection and reject stale mixed results.
- Keep persisted paths repository-relative. Treat compiler diagnostics and declaration maps as untrusted text/paths, not instructions or fetchable URLs; reject escaping output/source-map paths and avoid copying raw absolute-path diagnostics into saved/public evidence.

### Contracts and graph integration

- Parse compiler-produced declarations/source maps with the existing parser where supported. Retain selected signatures, tagged unions and referenced contracts; declaration syntax alone is not complete semantic dependency closure.
- Resolve supported local aliases/re-exports to file-qualified identities. For external types, overloads, generics, declaration merging or computed types, preserve supported contracts faithfully or report limitations. Matching names are not symbol identity.
- Reuse normalization, evidence, coverage, context and impact. Keep compiler diagnostics separate from graph completeness: failed compilation, partial graph and successful check are different states.
- Keep spec → source/type/check links explicit and reviewable. Do not join binary/source symbols automatically by name or treat compatibility as requirement proof.
- Reuse runtime input validation. No schema framework, second graph index, language-plugin ecosystem or mandatory runtime npm dependency is planned.

**Exit:** production integration resolves a selected re-exported contract, accepts valid code, rejects an invalid transition with the real diagnostic, detects an imported contract change, reports affected nodes and passes after repair. Cover repeated names, missing symbols/compiler, unsupported version/configuration, malformed runtime input, partial dependencies, timeouts, stale inputs and cleanup. If declaration extraction cannot meet this bounded contract, revise #333 before expanding scope.

## 4. Measure, then optimize

Extend `scripts/benchmark-retrieval.ts` and `scripts/benchmark-repositories.ts`; do not add a benchmark framework. Pin baseline/candidate commits, runtime, corpus revisions, task labels, graph limits and cache state. Capture the pre-cleanup baseline before changing runtime code.

Measure CLI startup, cold/warm refresh, single-file edits, context, impact, path/MCP queries and type inspection. Record p50/p95 latency, peak RSS, serialized bytes and packed size. The current retrieval harness reports a post-retrieval RSS snapshot, not peak memory; add isolated measurement where needed. Use repeated comparable runs, at least 20 measured retrieval samples, and report variance.

Profile first. Reduce repeated parsing/index construction, duplicated traversal or unnecessary serialization only when measurements justify it. Test caches against changed/deleted/replaced files and configuration changes. Compare returned facts, evidence, limits and errors before speed. Include cyclic/high-fan-out graphs and fixed public repository tasks; keep private inputs and machine-specific logs local.

**Exit:** sanitized before/after report, unchanged correctness and documented tradeoffs. No unexplained material regression. No arbitrary percentage/line-count target, unsafe cache or dropped provenance to improve a metric.

## 5. Verify the completed candidate

| Area | Release requirement |
| --- | --- |
| Spec/code workflows | A reproducible spec/code change exercises validation, refresh, context and impact; stale, invalid and ambiguous input fails explicitly. |
| REA/Ghidra | Forward and backward exports retain caller → callee meaning, binary/export identity, coverage and limitations. Require the producer direction; missing evidence is not proof of independence. |
| Types | One bounded, opt-in adapter uses an explicitly supported compiler/configuration. A valid → invalid → repaired example demonstrates real diagnostics and affected-node traversal. Unsupported versions, missing symbols and partial dependencies remain explicit. |
| Compatibility | Supported graph formats, CLI exits, JSON/MCP contracts and removable integrations pass regression checks. User-owned specs/settings are preserved. |
| Security | Parser, filesystem, child-process, hook and provider boundaries are reviewed; reproduced findings have regressions. No unresolved high-impact release defects. Advisory scans supplement manual review. |
| Runtimes | Linux/macOS/Windows CI passes; clean consumers exercise the packaged CLI on supported Node/Bun runtimes, including the declared Node minimum. |
| Agent hosts | Codex/Claude skill discovery, invocation, edit refresh and removal are verified in the actual hosts. Installed files alone are not sufficient. |
| Documentation | Stable installation and development-candidate instructions are distinct. Commands, migration notes, package/extension versions and supported limitations agree. |
| Release integrity | Approve the final commit; pack once, retain hashes, test those bytes, resolve prerelease findings and publish only the verified archive with provenance. |

## Implementation status

The core implementation at `22b0b7e` passed 116 local tests and the [Linux Node 22/24, macOS Node 24 and Windows Node 24 matrix](https://github.com/specdog/dotdog/actions/runs/41268166006). Its fixes include checked workspace data, traversal provenance/coverage, bounded search and context errors, repository-safe path reads and explicit REA direction. Real forward/backward Ghidra fixture checks passed without executing or changing the target. See [audit](v1-security-audit.md), [migration](v1-migration.md) and [native fixture](../examples/native/README.md).

The [type research](https://github.com/specdog/specdog.github.io/pull/66) has 62 passing checks, including native TypeScript 7.1 beta symbol/signature and snapshot probes. This is not the production adapter: the 5/6 extractor is not compatible with the candidate's installed 7.0.2 API. Full project/reference handling and a supported adapter remain work in #333. Do not require a beta compiler for all users or infer requirement satisfaction from a compiler pass.

Freeze features before final review. Reconcile findings against the complete release diff. A failed or skipped required gate is not a release pass. Do not hide failures by reducing coverage or replacing real integrations with mocks. A SolidState wrapper pass establishes only what its underlying check exercised.

## Outstanding launch gates

- Complete #333 and its production integration/compatibility tests.
- Complete #334 code/bloat audit and #335 measured optimization report.
- Complete actual Codex/Claude host acceptance and final security review in #336.
- Freeze the final candidate, verify minimum-runtime/package behavior and resolve prerelease feedback.
- Verify npm trusted-publisher configuration and obtain release approval. Tests of the publishing script do not verify registry permissions.

The release remains unmerged and unpublished until these gates are complete. Existing live-provider behavior requires real-target evidence before making live-integration claims; it is not a cloud-provisioning prerequisite for the scoped graph workflows.

The separate TypeScript 7.0.2 CLI probe checked valid → invalid → repaired code, compiler-emitted signatures, a re-export and declaration maps without changing the project configuration. The current packaged candidate passed clean-consumer checks on Node 22.12.0, Node 24, Node 26 and Bun. These bounded checks do not establish production type integration, complete audit coverage or a measured speedup.

## 6. Release integrity and approval

After required gates pass, approve the final commit and version. The current development version is 1.0.3; align metadata to the approved version without silently downgrading it. Follow the repository's source/package version-bump rule. Do not commit build output.

Pack the final candidate once, retain commit/version/file manifest/digests, test those exact bytes and publish only that archive. Changed candidate bytes invalidate the previous artifact approval. Resolve approved prerelease feedback before stable publication; prerelease publication also requires approval.

The existing workflow uses a GitHub-hosted Node 24 runner, `id-token: write`, a version-matching tag whose commit is on `main`, and the verified tarball. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires npm >= 11.5.1 and Node >= 22.14.0; its package configuration must match the repository/workflow and permit the chosen publishing action. Do not assume a newly configured publisher permits direct publishing. [Provenance](https://docs.npmjs.com/generating-provenance-statements/) also requires matching public repository metadata. These publishing requirements are separate from the package's runtime minimum.

After testing/review and explicit approval, merge, tag the approved main commit and push only that specific tag. Verify the installed version/provenance and run an isolated post-publication smoke check before marking release complete. If defective, deprecate the affected version and issue a tested patch; never overwrite an npm version.

## Contribution boundaries

Keep changes focused and record reproduction, repair and verification for findings. Preserve human-owned specs and unrelated settings. Keep personal information, credentials, conversation records and raw private evidence out of public artifacts; publish only necessary documentation and sanitized technical evidence. No claim of bug freedom, complete security or physical safety follows from this plan.
