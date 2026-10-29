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

## Additional systems and dependency costs

Additional primary-source checks on 2026-10-29 broaden the comparison beyond graph-agent repositories. These remain research candidates, not Dotdog dependencies or reproduced vendor benchmarks.

| System | Documented capability | Adoption consideration |
| --- | --- | --- |
| [Orama](https://github.com/oramasearch/orama) | JavaScript/TypeScript full-text, vector and hybrid retrieval | Closest portable npm candidate; [Apache-2.0](https://raw.githubusercontent.com/oramasearch/orama/main/LICENSE.md). Embeddings still need an encoder. `@orama/orama@3.1.18` has about 2.19 MB unpacked package content, not a verified installed footprint |
| [HelixDB](https://github.com/helixdb/helix-db) | Rust graph/vector/BM25 database, TypeScript SDK; Apache-2.0 | Evaluate only when server operations and deployment cost are justified; not a drop-in embedded JS index |
| [Qdrant](https://qdrant.tech/documentation/hybrid-queries/) | Filtered vector retrieval and multi-stage hybrid fusion; Apache-2.0 | Strong external-service comparison, not a property-graph replacement. Verify [network/TLS/API-key settings](https://qdrant.tech/documentation/security/) for any deployment |
| [SurrealDB](https://surrealdb.com/surrealdb/graph) | Combined graph/vector queries | Current [license](https://raw.githubusercontent.com/surrealdb/surrealdb/main/LICENSE) is BSL 1.1 with an additional-use grant and change date, not an interchangeable MIT/Apache dependency |
| [FalkorDB](https://github.com/FalkorDB/FalkorDB) | Graph/vector server and a Graphiti backend | Current [server license](https://raw.githubusercontent.com/FalkorDB/FalkorDB/main/LICENSE) is SSPL v1; deployment/license fit requires review before selection |
| [Cozo](https://github.com/cozodb/cozo) | Datalog graph queries with [HNSW vector search](https://docs.cozodb.org/en/latest/vector.html); MPL-2.0 | Not archived at the snapshot, but repository API last push was 2024-12-04 and latest release 0.7.6 was 2023-12-11. Maintenance is a material concern |
| [RuVector](https://github.com/ruvnet/RuVector) | Rust/WASM vector/graph-related modules; MIT | Inspect the actual modules and supported APIs before relying on broad learning/performance claims; research prototypes are not proof of a supported Dotdog capability |
| [Transformers.js](https://huggingface.co/docs/transformers.js/custom_usage) | Local embedding inference; Apache-2.0 runtime | Encoder, not database. Remote model loading/caching needs explicit offline controls, pinned artifacts and per-model license checks |

Registry metadata shows why wrapper size alone is misleading: `@ladybugdb/core@0.22.1` is about 72 KB but selects optional native binaries and includes build tooling; `sqlite-vec@0.1.9` is about 4 KB before its native platform package. `@lancedb/lancedb@0.40.0` is about 1.48 MB before native packages and optional integrations. `@huggingface/transformers@4.3.2` is about 9.99 MB before ONNX runtimes, Sharp and model weights; that version also declares a development-tagged ONNX web runtime. None of these wrapper figures is a measured final installation or a vulnerability finding. Audit the actual resolved candidate tree before adoption.

The current fit is exact local graph indexes first, lexical/graph retrieval as the baseline, and an optional semantic sidecar only if held-out tasks justify its operational cost. See [measured retrieval results and the VSA/superposition assessment](retrieval-benchmarks.md). The controlled graph benchmark is not a benchmark of these engines.
