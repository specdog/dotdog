---
layout: default
title: Dotdog 1.0 security and release sweep
---

# Dotdog 1.0 security and release sweep

Date: 2026-10-29. Scope: the unpublished npm/Bun 1.0 candidate in PR #332, following the [0.9.0 artifact audit](npm-0.9-audit.md). This is a source review plus local regression testing, not a third-party penetration test or a safety certification.

## Confirmed findings and repairs

| Finding | Observed failure / precondition | Repair and regression |
| --- | --- | --- |
| Dangling output symlink | A repository symlink to an absent external file passed path resolution | Detect dangling symlink components; refuse writes through symlinked output paths |
| Generated-file overwrite | `map` followed an existing `repo.dag` symlink and overwrote an external fixture | Check each generated/cache/compiled destination, not only its directory |
| Git inventory escape | A tracked source directory replaced with an external symlink was still included | Resolve and reject symlinked inventory paths before reading/hashing |
| Forged hook ownership | A crafted hook manifest could name and hash an unrelated repo file; remove deleted it | Validate the expected Git/Claude target and the exact installed hook identity; preserve edited hooks |
| Parser denial of service | `[1/1]` steps and non-table pipe lines stalled compilation | Guarantee parser progress; reject unclosed plain fences; keep fenced headings out of section splitting |
| Unbounded MCP input | Line buffering had no explicit size limit | Stream requests sequentially, enforce a 1 MiB line limit and respect output backpressure |
| Provider dispatch guesses | Railway selected discovered tools by substring; Cloudflare used literal `:account_id`; remote MCP probes lacked auth | Remove the unused hand-written external MCP client and probes; use explicit documented read-only API routes |
| Railway query construction | Resource text was interpolated into GraphQL source | Use a fixed query with variables; use service IDs and token-specific headers |
| Provider false passes | Supabase project fallback ignored requested tables; provider/entity filters did not intersect | Report tables unverified, intersect filters, and fail strict live checks for non-pass results |
| Endpoint false passes | Expected values/types were ignored; missing-body handling was truthiness-based | Compare expected JSON recursively, including false/zero/null and arrays; extra object keys remain allowed |
| Endpoint resource handling | Timeout was cleared before the body finished; failure paths could double-count | Keep timeout through body reads, cap JSON bodies at 1 MiB, reject redirects/embedded URL credentials, count once |
| Ambiguous graph references | Duplicate labels could resolve to whichever node was last/first | Prefer exact IDs; reject ambiguous labels and expose candidate IDs |
| Stale extractor cache | Cache key did not include package/parser upgrades | Include package, parser and extraction-schema versions in the key |

The symlink/hook regressions were run before repair and all four failed; after repair they passed while external evidence bytes and unrelated files were preserved. Parser and provider/contract cases have dedicated regressions. These are local malicious-checkout scenarios, not evidence of an observed compromise in a user's installation.

## Dependencies and release integrity

The original development tree had known advisory matches, including SDK 1.29.0 and transitive HTTP/schema packages. SDK is now 1.32.2. Explicit root overrides select patched compatible transitive packages where ordinary Bun updates retained vulnerable resolutions. Babel stays on 7.29.11 because Babel 8's engine range excludes the supported Node 22.12 baseline. Chalk is updated to 6.0.1.

`bun audit --json` returned `{}` after these changes. This is an advisory-database snapshot, not malware detection or proof that all dependencies are safe. The shipped CLI remains self-contained with no declared runtime npm dependencies; SDK/AJV and their HTTP stacks are development/test dependencies, not bundled runtime services. Babel, Chalk and Commander are bundled and retain third-party notices.

CI now includes a scheduled and dependency-change advisory audit, frozen lockfile installation, pinned action revisions, packed-consumer checks and a real MCP SDK stdio client regression. Dependabot is configured for Bun and GitHub Actions using GitHub's [documented Bun ecosystem support](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). The npm publish job checks tag/version agreement, tests/builds the candidate, requests provenance and requires its tagged commit to belong to main history. Trusted-publisher/account configuration and branch protection remain external settings; this PR does not prove they are enabled.

## Boundaries and remaining gaps

- `serve` is local stdio, not an HTTP service. Graph content and imported descriptions are untrusted data, not permission or agent instructions.
- Graph reads/imports use a 32 MiB input cap, 100,000-node/500,000-edge normalization limits; MCP combined graph text is capped at 128 MiB. These are finite processing limits, not CPU/memory guarantees. Local repository mapping and all legacy command outputs are not globally quota-managed.
- Generated writes and inventory traversal reject static symlink escapes. No claim is made of race-free multi-user filesystem isolation; an OS sandbox remains authoritative.
- Credential-file exclusions and output redaction are best-effort. Specs, source, filenames and derived graphs can contain private data. Review exports; do not put credentials in graph properties.
- `live` explicitly contacts spec-defined HTTP(S) URLs, including permitted local endpoints. Review untrusted contracts before running it. Provider calls use fixed API origins and reject redirects; AWS uses the installed CLI and its existing credential configuration. No blanket SSRF-proof claim is made.
- Provider tests use mocked API responses and request assertions. Live cloud accounts, current provider permissions, rate limits, Windows and modern client UI sessions were not exercised.
- REA import passed source-schema fixture validation earlier in this PR; live Ghidra target analysis remains unverified. No separate REA provider was installed or registered.
- Embodied support checks supplied evidence relationships only. It discovers neither missing real-world hazards nor measurement quality and grants no physical authority.

See [migration](v1-migration.md), [peer research](graph-peer-research.md) and [embodied evidence](embodied-systems.md) for supported behavior and explicit limits. The candidate remains unmerged and unpublished until separately released.

## Local verification record

The consolidated full suite passed with 96 tests, 391 assertions and one snapshot. Hosted CI status is recorded in PR #332. Typechecking, build, frozen install, skill validation, extension manifest, real demo, and Dotdog's own validate/check/doctor/status checks passed. Packed consumer checks passed under Node 22.12.0, 24.22.1, 26.8.1 and Bun 1.3.14, including a synthetic embodied evidence success/tamper-failure case. The candidate tarball measured 181,077 bytes at that check; this is larger than the original 0.9 artifact and no compression improvement is claimed.
