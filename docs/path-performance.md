---
layout: default
title: Path-search performance
---

# Path-search performance

The unreleased 1.0.0 candidate stores one parent link per queued BFS node instead of copying its complete path history. It reconstructs only the winning path and returns zero-hop results before constructing adjacency. Direction, hop limits, edge evidence and output ordering are unchanged.

## Measured comparison

Baseline: `d94a8f4`. Runtime: Bun 1.3.14, macOS arm64. The existing retrieval harness now includes MCP path queries and a 32,767-node four-way tree. Each case has ten warmups; the second comparison reverses implementation order. Normalization is included in path timings. [Sanitized measurements and source/harness fingerprints](../benchmarks/retrieval/path-review.json) retain p50/p95 values and matching path-payload hashes.

| Case | Samples | Before p50 / p95 (ms) | After p50 / p95 (ms) |
| --- | ---: | ---: | ---: |
| Zero-hop path | 20 | 19.15 / 23.84 | 16.84 / 20.47 |
| Wide-tree path | 20 | 28.22 / 36.92 | 22.97 / 27.40 |
| Zero-hop, reverse-order replay | 50 | 18.68 / 24.36 | 15.82 / 19.67 |
| Wide-tree, reverse-order replay | 50 | 28.07 / 32.98 | 22.37 / 25.81 |

These cases show roughly 12–20% lower median path latency, not a universal speedup. Ordinary two-hop MCP path p50 was 24.48 → 25.07 ms initially and 24.61 → 24.63 ms in the replay: no improvement is established there. Other retrieval medians were similar; tail variation remains visible in the report. There is no measured peak-memory, package-size, cold-start or end-to-end agent improvement claim.

## Reproduce

From a built development checkout with its frozen dependencies installed, use a new temporary directory. These are maintainer benchmarks, not product prerequisites.

```sh
DOTDOG_BENCH_DIR="$(mktemp -d)"
git worktree add --detach "$DOTDOG_BENCH_DIR/before" d94a8f4
ln -s "$PWD/node_modules" "$DOTDOG_BENCH_DIR/before/node_modules"
bun scripts/benchmark-retrieval.ts --tokenizer packages/dotdog/node_modules/gpt-tokenizer --implementation "$DOTDOG_BENCH_DIR/before" --nodes 32767 --samples 50 --output "$DOTDOG_BENCH_DIR/before.json"
bun scripts/benchmark-retrieval.ts --tokenizer packages/dotdog/node_modules/gpt-tokenizer --nodes 32767 --samples 50 --output "$DOTDOG_BENCH_DIR/after.json"
```

Repeat in reverse order and compare result hashes before timings. The harness also checks exact neighborhoods, retained evidence, changed-graph reloads and missing queries. Its old assertion that a depth-limited neighborhood was not truncated was stale; it now requires explicit truncation without changing the expected returned neighborhood.

An independent all-pairs-distance regression exercises cyclic directed graphs, incoming/outgoing/any traversal, verb filters, zero-hop cases, hop limits, path continuity and edge evidence. This supplements the synthetic timing cases; it does not prove bug freedom or optimality. Broader optimization and final release gates remain in [#335](https://github.com/specdog/dotdog/issues/335) and the [release plan](v1-release-plan.md).
