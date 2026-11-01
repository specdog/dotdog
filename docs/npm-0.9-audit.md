---
layout: default
title: npm audit and modernization assessment
---

# Published npm audit and 1.0 assessment

Audited 2026-10-28/29. Target: npm `dotdog@0.9.0`, published 2026-07-18, source commit `4edd243cfec0ab37f789c64ddf53ea2ebf9cb9bc`. The release tarball SHA-1 was `5021a0d036ab5508d4cb19325a22e8cc98f542d1`. The Rust branch was excluded from the published-release audit.

## Evidence

- Downloaded the actual registry tarball and exercised its CLI independently of repository source.
- Existing suite: 58 passing tests, zero failures. These tests did not establish correctness of the failing cases below.
- `scripts/audit-npm.py` records 38 top-level diagnostic cases, including all seven built-in kits, protocol requests, mapping boundaries, destructive reruns and localhost endpoint contracts. It is an observation harness, not 38 independent passing assertions.
- Registry install scan: zero known production dependency advisories returned by `npm audit`; this is not a comprehensive vulnerability finding.
- Package contents, build and Spec Kit packaging passed. Workspace lint failed because its nominal check command executed program entrypoints rather than type-checking them.

## Confirmed release defects

| Priority | Observed in 0.9.0 | 1.0 handling |
| --- | --- | --- |
| High | Re-running `init saas` overwrote a kit; the compiled graph went from three nodes to zero. | Refuse existing projects. |
| High | MCP traversal of SaaS Organization returned only Organization; numeric edge targets never matched entity names. | Shared format-aware reader resolves named links. |
| High | `compile --v2` followed by MCP search logged a TypeError and produced no tool response. | v2/v3 use the same normalized graph model. |
| High | Expected JSON endpoint response passed when the server returned non-JSON text. | Non-JSON fails when a JSON contract is expected. |
| High | Default v3 live graphs were ignored; `live --exit-code` could find no endpoints and still return success. | Preserve endpoint subtype metadata, read it consistently and fail explicit missing-contract checks. Legacy graphs require recompilation. |
| Medium | Every built-in kit reported a two-byte graph payload and 99.9% savings. | Measure the actual serialized payload; label token estimates. |
| Medium | The compiler retained defaults but discarded most property definitions. MCP `schema` could be empty while `getEntity` scraped source to reconstruct it. | Preserve definitions in the compiled graph; remove source reconstruction from MCP. |
| Medium | `init --minimal` immediately failed validation for its missing constitution. | Align required files with the supported minimal scaffold. |
| Medium | Empty scaffolds were called 100% complete despite zero graph nodes. | Describe required-file presence, not product completeness. |
| Medium | Missing path returned exit 1 in text mode but exit 0 in JSON mode. High-severity drift also returned 0. | Consistent nonzero failure exits. |
| Medium | A 501-file directory silently mapped only 500 files. | Remove the implicit cutoff; report real extraction limits. |
| Medium | Root app routes were missed and `pages/index.tsx` was labeled `/index`. Generic source files were largely absent. | Inventory files, fix root routes, add JS/TS declarations and relative-import edges. |
| Medium | Search for `subscription` returned no results from the SaaS kit after indexing. Document frequency counted occurrences; source was truncated before vectorization. | Correct document frequency, retain vectorization content, smooth IDF and index individual headings. |
| Medium | MCP replied to notifications, rejected ping, hardcoded an old server version and could drop requests lacking optional arguments. | Standard errors/notification handling, truthful version, validation and compatibility tests. |
| Medium | Pre-commit guessed `SPEC.dag` from `SPEC.dog`, although compilation wrote the project-named graph; it compiled the working tree rather than the index. | Staged-snapshot check without automatic staging. |
| Low | Repeated observation counted generated `.doghouse` output as scan input. Community kit installation was advertised without an implemented command. | Exclude generated output and remove the nonexistent command suggestion. |

Source locations in the audited release: [CLI](https://github.com/specdog/dotdog/blob/4edd243/packages/dotdog/src/cli.ts), [MCP](https://github.com/specdog/dotdog/blob/4edd243/packages/dotdog/src/serve.ts), [search](https://github.com/specdog/dotdog/blob/4edd243/packages/dotdog/src/index.ts), [mapper](https://github.com/specdog/dotdog/blob/4edd243/packages/dotdog/src/map/repoMapper.ts), [hook](https://github.com/specdog/dotdog/blob/4edd243/templates/pre-commit-dotdog.sh).

The documented Node 20 minimum also disagreed with Commander 15's declared Node 22.12 minimum and Dotdog omitted `engines`. Node 20 could execute `--version` in the audit; a comprehensive Node 20 failure was not demonstrated. 1.0 explicitly targets Node 22.12+ instead of claiming unsupported compatibility.

## Product assessment: keep the package, change the workflow

Keep npm/Bun as the distribution, CLI as the deterministic engine, and MCP as a query adapter. Add repository skills for agent guidance, opt-in hooks for routine freshness, and independent CI enforcement. Skills cannot guarantee execution; editor hooks cannot observe every edit; CI does not replace task-time context. These are complementary layers.

The existing issues [#319](https://github.com/specdog/dotdog/issues/319) and [#317](https://github.com/specdog/dotdog/issues/317) already described incremental updates/hooks and MCP modernization. The 1.0 implementation is tracked in [#331](https://github.com/specdog/dotdog/issues/331). The separate Rust port remains in [#330](https://github.com/specdog/dotdog/pull/330).

## Useful upstream resources

Star counts are snapshots from GitHub's API on 2026-10-29, not evidence of correctness or adoption by Dotdog users.

| Resource | Relevant pattern | Dotdog decision |
| --- | --- | --- |
| [Graphify](https://github.com/Graphify-Labs/graphify), 137,957 stars | Agent-native entry point, extraction with explained relationships, persistent graph context. | Ship a focused skill and evidence-linked queries. Do not copy its code or claim all-language/multimodal parity. |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus), 48,099 stars | Repository intelligence, impact-oriented queries, graph exploration. | Add bounded reverse-dependency context. Do not treat star count or graph connectivity as runtime proof; respect its separate licensing. |
| [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28/schema), [Inspector](https://modelcontextprotocol.io/docs/tools/inspector) | Versioned contracts, structured results, validation and real client testing. | Support modern discovery alongside legacy initialization; retain local stdio. |
| [Codex skills](https://developers.openai.com/codex/skills), [Claude skills](https://code.claude.com/docs/en/skills), [Claude hooks](https://code.claude.com/docs/en/hooks) | Shared skill format; host-specific discovery and edit events. | One bundled workflow, repository-local installation paths, separate opt-in hook setup. |
| [Spec Kit extensions](https://github.github.com/spec-kit/reference/extensions.html) | Reuse existing workflow artifacts instead of replacing a user's process. | Preserve the existing importer/extension and version packaging together. |
| [SCIP](https://github.com/scip-code/scip), [Tree-sitter](https://tree-sitter.github.io/tree-sitter/), [ast-grep](https://ast-grep.github.io/) | Typed code-index interchange and structural extraction. | Evaluate for broader language/call resolution later; current extraction deliberately covers JS/TS declarations and static relative imports. |
| [JSON Schema](https://json-schema.org/understanding-json-schema/reference/type), [JSON-RPC](https://www.jsonrpc.org/specification) | Validate boundaries and distinguish protocol from application errors. | Normalize graph formats once and test bad inputs rather than accept silent shape drift. |

## REA / Ghidra fit

Dotdog can connect specifications with imported binary-analysis evidence without becoming another reverse-engineering provider. The implemented adapter reads REA's saved NativeCallGraph body, preserving source addresses, binary/export identity, coverage and limitations. REA/SolidState continues to own Ghidra, sessions and target authority.

The adapter's fixture was validated against the local REA NativeCallGraph schema using its pinned Zod 4.4.3 dependency in an isolated temporary bundle. No REA checkout dependencies or configuration were changed. No live Ghidra provider, target analysis or arbitrary REA Evidence-envelope interoperability was verified. Do not describe this as a validated end-to-end REA/Ghidra integration.

## Remaining limits

The broader mapping is not a complete call graph. Static relative imports and top-level JS/TS declarations are observed; aliases, dynamic dispatch, runtime effects and other languages' symbols are not inferred. Named context and impact results disclose their bounds. Heuristic analysis/simulation/staleness/text checks are not application test substitutes.

Retaining schemas increases some graph payloads. Universal 94% savings and zero-hallucination language were removed from the updated entry points. Measure task-level context and actual runtime costs before making future efficiency claims.

## Verification and measured tradeoffs

The expanded suite contains 76 tests, including real CLI, localhost endpoint, staged-index, freshness, legacy graph, modern metadata and output-schema checks. A real MCP TypeScript SDK client also connected to the built CLI and listed its tools/projects. Packed consumer checks passed on Node 22.12.0, Node 24.22.1, Node 26.8.1 and Bun 1.3.14. Live cloud providers, live Ghidra analysis and Windows execution were not exercised.

The final build bundles its parser and CLI libraries once rather than installing separate runtime packages. A representative packed build was 176,621 compressed bytes versus 84,918 for 0.9.0. Installed file contents were 707,635 bytes/29 files versus 618,851 bytes/51 files. These measurements exclude filesystem allocation overhead; package documentation and later source edits can change exact sizes. The AST capability costs additional bytes, so no overall size reduction is claimed. An intermediate external-dependency build occupied 5,411,469 installed bytes and was not retained.

An advisory scan of the exact bundled library versions and their declared dependencies returned zero known vulnerabilities. Because those libraries are bundled, auditing only the installed zero-dependency CLI would not establish that result.

A single local 100-source-file fixture produced 203 nodes and 301 edges. Cold refresh took 70.60 ms; an unchanged content-hash refresh took 47.73 ms without extraction; a one-file change took 67.57 ms and correctly removed one import edge. These are individual end-to-end wall-time observations, not a general benchmark. CPU time, process-family memory and model-token costs were not established. The 10-run startup observations were roughly 37–40 ms across the audited builds; no startup speedup is claimed.
