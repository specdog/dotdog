---
layout: default
title: Graph tooling research — October 2026
---

# Graph tooling research — October 2026

Selected high-star graph/context peers, discovered through GitHub search and checked with the GitHub repository API on 2026-10-29. This is not an exhaustive ranking, a quality score or a reproduced performance comparison. Features below are documented by their maintainers unless source inspection is stated.

| Project | Stars at snapshot | Relevant documented pattern | Dotdog decision |
| --- | ---: | --- | --- |
| [Graphify](https://github.com/Graphify-Labs/graphify) | 137,988 | Shared configuration, incremental extraction, explicit query ambiguity | Keep a common refresh/status path and invalidate extraction caches across extractor versions |
| [CodeGraph](https://github.com/colbymchenry/codegraph) | 75,787 | Index/sync/status, agent installation and change-impact queries | Provide opt-in skills/hooks plus independent CI; no automatic daemon or telemetry |
| [Aider](https://github.com/Aider-AI/aider) | 49,802 | Graph-ranked repository maps under a context budget | Keep bounded neighborhoods and report truncation; do not claim tokenizer measurements |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | 48,099 | Context, impact, trace, change detection and freshness status | Separate structural diagnostics from runtime verification; make stale/ambiguous results explicit |
| [Repomix](https://github.com/yamadashy/repomix) | 29,062 | Include/ignore controls, structured context packaging and tokenizer-aware counts | Preserve ignore boundaries and measured byte estimates; token-budget ranking remains future work |

Graphify's [cache implementation](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/cache.py) was inspected: extractor identity and grammar/schema versions participate in AST cache namespacing. Dotdog's cache key now includes its package version, Babel version and extraction-schema revision, alongside file/inventory hashes. This adopts the invalidation principle, not source code. Dotdog does not perform Graphify-style LLM semantic extraction.

Aider's [repository-map documentation](https://aider.chat/docs/repomap.html) explains its graph-ranking and token-budget mechanism. Dotdog's node/edge limits are not equivalent to that relevance ranking, and byte/4 estimates are not actual model-token counts.

Licenses checked at the snapshot: Graphify and Aider Apache-2.0; CodeGraph and Repomix MIT. GitNexus's README states PolyForm Noncommercial 1.0.0; GitHub's license API returned NOASSERTION. No GitNexus code was copied. Recheck licenses before reusing code; popularity does not establish license compatibility.

## What changed in Dotdog

- Keep npm/Bun as one package distribution, with Codex/Claude skills above CLI/MCP execution interfaces.
- Replace unsupported claims in `staleness`, `simulate`, and `verify` with narrow read-only checks and explicit compatibility warnings.
- Keep spec intent, observed source structure and reverse-engineering evidence distinguishable.
- Add evidence identity/freshness checks and optional [embodied-system relationship coverage](embodied-systems.md), without device control.
- Remove unused parallel `@spec/*` implementations, unwired scanners, scratch parser copies and invalid global-log benchmark comparisons.
- Do not adopt every peer feature: no auto-installed provider, background service, telemetry, vector database or speculative multi-language call-graph claim.

## Release assessment

The strongest fit is a small local evidence/intent graph with predictable automation and bounded agent context, not a replacement for full language servers, robotics middleware or Ghidra. Broader language extraction, graph ranking and reviewed cross-project/source-to-binary reconciliation need their own measured fixtures before becoming release claims.

## Graph/vector systems checked for the 1.0 retrieval assessment

Snapshot: 2026-10-29. These are not all newly created projects. Database engines, memory frameworks and GraphRAG pipelines solve different problems; this is a shortlist, not an adoption decision or benchmark result.

| System | Checked metadata | Relevant mechanism | Dotdog assessment |
| --- | --- | --- | --- |
| [LadybugDB](https://github.com/LadybugDB/ladybug) | 1,888 stars; MIT; active; [0.22.0 released Oct 26](https://blog.ladybugdb.com/post/ladybug-0-22-0-release/) | Embedded property graph with [Node bindings](https://docs.ladybugdb.com/installation/) | Candidate for larger local graph persistence; measure native packaging/runtime cost first |
| [Graphiti](https://github.com/getzep/graphiti) | 32,320 stars; Apache-2.0; active | Temporal validity/provenance and graph/vector/keyword retrieval | Useful temporal/evidence design; it is a Python framework with its own backing-service needs, not a drop-in npm storage library |
| [LanceDB](https://github.com/lancedb/lancedb) | 11,804 stars; Apache-2.0; active | Local vector/full-text/SQL retrieval and TypeScript APIs | Candidate vector sidecar alongside Dotdog's authored/observed graph; not proof that a separate database is necessary |
| [Cognee](https://github.com/topoteretes/cognee) | 32,872 stars; Apache-2.0; active | Graph/vector/code context and persistent agent memory; Codex/Claude integrations | Study ingestion, recovery and evidence routing; distinguish base OSS functionality from licensed deployment features |
| [LightRAG](https://github.com/HKUDS/LightRAG) | 40,405 stars; MIT; active | Dual graph/vector document retrieval and incremental updates | Useful retrieval comparison; Python/LLM ingestion stack is not equivalent to a lightweight code-spec CLI |
| [sqlite-vec](https://github.com/asg017/sqlite-vec) | Upstream explicitly pre-1.0 | Small C SQLite vector extension; successor to sqlite-vss | Candidate minimal local vector store; pin/test exact extension and ABI, and do not assume alpha ANN behavior is stable |

[Kuzu's repository](https://github.com/kuzudb/kuzu) is archived (API confirmed; last push 2025-10-10). Graphiti also documents its Kuzu backend as deprecated. Do not add Kuzu as a new Dotdog dependency. Existing supported data should be migrated or exported, not silently discarded.

Proposed evaluation: compare current lexical retrieval with semantic candidates plus bounded graph expansion on the same labeled repository tasks. Record relevance, latency, peak memory, index size, deletion/staleness handling, package/platform cost and offline behavior. Embedding metadata must identify model, dimensions and input digest; changed models invalidate their indexes. Remote embeddings require explicit configuration and must respect exclusions. Similarity must never manufacture an authored relationship, verified fact or physical authority.

No listed engine/framework has been installed or benchmarked in Dotdog by this research pass. Native dependencies, model downloads, telemetry, licensing and secret-handling behavior need verification before adoption.
