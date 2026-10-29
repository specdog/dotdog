---
layout: default
title: Dotdog 1.0 release implementation and acceptance plan
---

# Dotdog 1.0 release implementation and acceptance plan

Scope confirmed 2026-10-29: a substantial, polished npm/Bun release with useful graph/agent features, verified cleanup and security work. Windows, real Codex/Claude workflows, live cloud validation, a reproducible REA/Ghidra example, measured performance work and an embodied-system demonstration belong in 1.0. They are not automatically deferred to 1.1 to meet a date.

The existing 96-test green candidate is a baseline, not completion. Every gate needs actual evidence against its named artifact/environment. No claim of absolute bug freedom, complete security or hardware safety follows from this plan.

## Ordered work and exit criteria

| Gate | Concrete implementation | Acceptance evidence |
| --- | --- | --- |
| Stable public contracts | Inventory every command/MCP tool, JSON shape, exit status, graph/profile version, deprecated alias and migration rule | Golden success/error fixtures; old supported graph formats load; invalid/ambiguous inputs fail explicitly |
| Filesystem and concurrency | Crash-safe generated writes; serialize conflicting refreshes; stale-lock recovery; preserve user-owned inputs and permissions | Interrupted write leaves old or new complete file; concurrent refresh cannot publish inconsistent state; static symlink attacks preserve outside files |
| Security sweep | Review parser/import boundaries, secret exposure, child processes, hook trust, dependency/runtime code, action permissions and publication authority | Reproduced findings with regressions; no unresolved known critical/high-impact release defects; advisory check plus manual boundary review |
| Cross-platform package | Linux/macOS/Windows Node execution, Bun installation/execution, paths with spaces/non-ASCII and command shims | Hosted OS matrix and clean packed-consumer installation of the same candidate bytes |
| Real agent workflows | Codex/Claude skill discovery, explicit invocation, edit refresh, staged checks and uninstall/edit preservation | Recorded host versions and actual actions/results; filesystem installation alone does not count |
| Live provider integration | Use designated read-only cloud projects for advertised provider/resource mappings; test permission and missing-resource failures | Sanitized live request results, target identity, token scope and limits; mocks do not satisfy this gate |
| REA/Ghidra | Build a small openly licensed source fixture, analyze it through SolidState-owned Ghidra, import saved NativeCallGraph evidence, query a known relationship | Source/compiler/binary/export digests, real provider versions and coverage, reproducible commands; no separate REA registration |
| Meaningful embodied workflow | Link concrete requirements/components/sensors to simulator or test-rig outputs; demonstrate change impact and stale/tampered/failing evidence | Actual simulator/test-rig producer and recorded results; a hand-authored passing fixture is not a hardware/simulation validation |
| Performance and context | Representative repository benchmarks; cold/warm/single-edit extraction, query latency and peak memory; task-focused context and verified tokenizer budget | Reproducible fixtures/raw measurements; omissions disclosed; optimize measured bottlenecks without dropping facts |
| Command cleanup and polish | Retain useful commands, narrow misleading ones, remove genuinely purposeless code; complete help/examples/docs/error consistency | Purpose/consumer review, migration notes, executable examples and end-to-end failure behavior |
| Release integrity | Pack once, hash and test that tarball, retain verification manifest, publish only those bytes with provenance | Recorded artifact SHA-256/SHA-512, clean-consumer tests, trusted-publisher configuration verified, prerelease feedback resolved |

## Execution rules

1. Keep focused follow-up commits in the existing 1.0 branch/PR, linked to this acceptance plan. No main merge, tag or publication has been authorized by defining the scope.
2. For each finding record reproduction, effect, repair and rerun. Do not use test count as a quality target or remove a meaningful failing check to get green CI.
3. Preserve human-owned specs, unrelated hooks/settings and existing source data. Deprecated commands must identify the replacement and limits; no silent success for retired behavior.
4. Mark blocked gates precisely. The cloud project/account and simulator/device are awaiting designation. Claude CLI was not found on the current PATH. The Ghidra/REA/Dotdog macOS arm64 fixture has now run successfully; see examples/native/verification.json. Windows CI exposed a CRLF/frontmatter defect, now repaired and awaiting the next hosted run. These are pending work/access, not passed or waived gates.
5. Keep provider credentials, raw private exports and hardware recordings out of public commits. Publish only reviewed, sanitized evidence and reproducible public fixtures.
6. Freeze new feature scope only after the agreed work is implemented. Then run the complete release matrix, exercise a prerelease, resolve feedback and request final release authorization.
