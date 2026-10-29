---
layout: default
title: Retrieval cost and superposition assessment
---

# Retrieval cost and superposition assessment

Measured 2026-10-29. Token savings and lookup speed are separate objectives: a compact index does not by itself reduce the readable evidence sent to a model. Approximate retrieval must not replace exact graph facts or provenance.

## First measured optimization

The MCP handler rebuilt entity maps and adjacency for each lookup, and escaped/serialized all graph source text again to compare it with the previous request. It now retains indexes for each loaded graph and compares a SHA-256 content fingerprint. It still reads and hashes source content on each graph request: same-size edits with restored timestamps are detected, as are deleted and invalid graphs. This is not a stat-only freshness shortcut.

Controlled fixture: 10,000 nodes, 9,687 directed edges, independent 32-node chains, exact-ID queries. Each process performs 10 warm-up iterations and 50 measured iterations per tool. Three independent before/after process pairs were run on Apple M4 Pro, macOS arm64, Bun 1.3.14. The before implementation is commit `056931996890e3bc94793056494e8d24f87427c3`; after source-diff digests are retained in the reports. Results below are medians of the three run-level percentiles, not pooled percentiles.

| In-process MCP operation | Before p50 / p95 (ms) | After p50 / p95 (ms) |
| --- | ---: | ---: |
| `getEntity` | 8.60 / 9.27 | 1.88 / 2.62 |
| `context`, depth 2 | 9.33 / 10.15 | 1.94 / 2.55 |
| `impact`, depth 2 | 9.19 / 10.40 | 1.91 / 2.58 |

The median warm-context p50 improved about 4.8× on this fixture. First-request context latency was 25.98 ms before and 24.43 ms after; this does not establish a meaningful cold-start improvement. Post-retrieval RSS snapshots ranged 416–438 MB before and 294–305 MB after. Those snapshots include fixture generation and runtime garbage collection: they are neither isolated index sizes nor peak-memory measurements.

Every measured neighborhood is checked against known node IDs, edge counts and evidence. Missing queries must report no answer; a changed description must reload. Separate regressions exercise same-size/restored-timestamp changes, ambiguity, direction, edge order, self-loops, filtering and invalid-graph recovery.

### Actual tokenizer counts, with a narrow baseline

Using pinned [gpt-tokenizer 4.1.0](https://github.com/niieani/gpt-tokenizer), explicitly selecting `o200k_base`:

- Entire normalized synthetic graph JSON: **1,032,158 tokens**.
- One five-node depth-2 context text payload: **483 tokens**.
- The complete MCP tool-result envelope, including structured JSON and text fallback: **1,044 tokens**.

The text payload is 99.95% smaller than dumping this entire synthetic graph. **This is not an improvement over the previous `context` tool:** before and after return the same payload. It is not an end-to-end task, billing, Claude-tokenizer, or current-model compatibility result. Prompt/tool definitions, chat framing, additional calls, output and host-specific handling of duplicated structured/text content are excluded. Selecting five records is useful only when those records suffice for the actual task; synthetic exact-ID assertions do not establish semantic relevance.

Raw samples and assertions are retained under [benchmarks/retrieval-2026-10-29](https://github.com/specdog/dotdog/tree/feat/v1-modernization/benchmarks/retrieval-2026-10-29). The tokenizer was installed in an isolated research directory with lifecycle scripts disabled, not added to Dotdog's runtime dependencies. Its npm unpacked package is about 28 MB; that cost is not justified for every CLI invocation merely to display a count.

### Reproduce

From a checkout with `bun install --frozen-lockfile` completed, choose new research/output paths and install the pinned tokenizer separately:

```sh
npm install --prefix /tmp/dotdog-tokenizer-lab --ignore-scripts --save-exact --no-fund gpt-tokenizer@4.1.0
bun scripts/benchmark-retrieval.ts --tokenizer /tmp/dotdog-tokenizer-lab/node_modules/gpt-tokenizer --output /tmp/dotdog-retrieval.json
```

The output must not already exist. `--nodes` and `--samples` vary scale/repetitions. `--implementation /absolute/other-checkout` runs the same fixture against another checkout with its dependencies installed. The script imports source using Bun; it does not exercise the packed executable, stdio transport or a real agent host. Do not run comparison processes concurrently. The first request includes loading/normalization but does not clear the filesystem page cache. No external embedding/model service is contacted.

## Does superposition help?

[Vector symbolic architectures / hyperdimensional computing](https://arxiv.org/abs/2106.05268) support approximate associative retrieval through binding and superposition. A bipolar example bundles key/value pairs as `M = sum(key_i * value_i)`, where multiplication is elementwise. Multiplying by a query key approximates its value plus interference; a cleanup memory chooses a candidate. [Holographic reduced representations](https://redwood.berkeley.edu/wp-content/uploads/2020/08/Plate-HRR-IEEE-TransNN.pdf) use related binding/unbinding with noisy reconstruction.

This is a genuine research direction, not lossless compression or a speed guarantee. Capacity and errors depend on dimensions, load, codebook and representation. Storing/generating the codebook and searching cleanup candidates have costs too. Random identity vectors do not supply semantic understanding. Neural-network [feature superposition](https://www.transformer-circuits.pub/2022/toy_model/) describes a different phenomenon and is not a ready-made repository retrieval backend.

For Dotdog, retain exact ID maps and graph relationships. Evaluate VSA only as an optional candidate-retrieval experiment, followed by exact evidence lookup. A model cannot consume arbitrary superposed vectors as readable facts without an appropriate decoder. Smaller vector storage must not be advertised as fewer prompt tokens.

## Remaining required evaluation

The follow-up [token-budgeted context evaluation](context-budgets.md) now measures frozen structural tasks on two real repositories. It compares existing context with lexical task ranking and an actual tokenizer budget. Neither pass completes the 1.0 performance gate: no standalone lexical/semantic-vector/VSA backend comparison or model answer evaluation has run yet.

1. Label real repository tasks with required evidence, difficult distractors and no-answer cases. Keep held-out tasks separate from tuning; include code, authored intent and reverse-engineering evidence without treating inferred links as facts.
2. Compare lexical retrieval, semantic-vector candidates, graph expansion and VSA under identical corpus/snapshot, top-k and context budgets. Record recall@k, ranking, evidence coverage, unsupported selections and answer abstention before claiming savings.
3. Measure first/warm requests, extraction/index build, single-file edits, deletion, model-change invalidation, p50/p95 latency, true peak memory, disk/index/package size and tokenizer/embedding overhead. Include VSA codebook and cleanup search, not only unbinding arithmetic.
4. Count the exact serialized prompt with a named, supported tokenizer; record extra retrieval calls and model output separately. Compare against the existing `context` behavior as well as full-corpus dumping. Report missing evidence and task success, not only shorter prompts.
5. Pin embedding model revision, digest, dimension and license. No implicit remote embeddings, model downloads or telemetry; verify offline and credential/exclusion behavior before enabling a sidecar. Stars and vendor benchmarks are not acceptance evidence.
