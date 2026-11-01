---
layout: default
title: Token-budgeted graph context
---

# Token-budgeted graph context

```sh
dotdog context 'file:src/controller.ts' --max-tokens 3000 --task 'Review emergency brake handling'
```

With MCP, call `context` with `q`, an explicit `project` when needed, `maxTokens`, and optional `task`. Existing `depth` and `limit` still bound the candidate neighborhood. `--max-tokens` implies compact JSON output; `--task` requires a budget. Omitting the budget preserves the existing context behavior and avoids initializing the tokenizer.

## Contract

- Budgets range from 128 to 131,072 tokens, counted over the entire compact JSON text payload using pinned `gpt-tokenizer@4.1.0`, explicit **`o200k_base`**. CLI line framing is outside the JSON payload. Counts are not based on bytes/4.
- This is not a Claude-tokenizer count, automatic model selection, a total chat budget, or a billing guarantee. MCP envelopes, duplicated structured output, tool definitions and other messages are excluded. The response identifies its encoding and scope.
- The root record is mandatory. Whole nodes retain properties, schemas, lifecycle and evidence; returned edges retain their recorded direction and provenance. A root that cannot fit produces `budget_too_small` and a `minimumTokens` value rather than a partial record or false success.
- Optional `task` ranking uses lexical matches in labels, source paths and descriptions, then graph distance and stable input order. It is not semantic embedding search. Task text is limited to 4,096 characters and treated as data, not executed instructions.
- Selection includes recorded connecting paths from the root. Extra edges between selected nodes are retained when they fit. No relationship is inferred from lexical similarity.
- `omitted.nodes`, `omitted.edges` and `truncated` disclose selection loss relative to the bounded candidate neighborhood. They do not count all omitted repository facts. Upstream traversal truncation remains visible. Ambiguous candidates are also bounded, without silently choosing one.

Fewer records are not proof of a complete answer. Inspect source evidence and request additional context when the task requires it. Source graph freshness, extraction limits and runtime verification still matter.

## Real-repository evaluation

Nine structural evidence tasks were frozen in commit `7fc302e` before budget implementation: three discovery tasks and six held-out cases. Source declarations and MCP graph neighborhoods were manually reviewed in two public snapshots:

| Repository | Revision | Extracted nodes / edges |
| --- | --- | ---: |
| [Commander](https://github.com/tj/commander.js) | `8247364da749736570161e95682b07fc2d72497b` | 500 / 432 |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | `39ae8e6192cf43273aaaf2de4169dfa9f7216e28` | 6,166 / 8,938 |

Each positive task specifies required records and their recorded `defines` relationships. Two negative controls require `endpoint_not_found`. The harness checks retained records/edges byte-for-JSON-value equality with the unbudgeted result and rejects dangling edges or exceeded budgets. These are retrieval-evidence checks, not executed application answers or a broad semantic benchmark.

| Context text total | Unbudgeted current context | Budgeted context |
| --- | ---: | ---: |
| All nine cases | 97,988 | 15,312 |
| Six held-out cases | 50,008 | 7,534 |

All nine cases retained their labeled records/relationships or correct missing-endpoint result. Combined text reduction was **84.37%** for this suite, **84.93%** on the held-out subset. This comparison is against existing bounded context, not a full-repository dump. It does not demonstrate billing savings, semantic recall outside these labels, or model answer correctness. The 483-token synthetic example in the [earlier benchmark](retrieval-benchmarks.md) used a different baseline and is not combined with these results.

There are costs. Two already-small Commander results grew by 64 tokens each due to budget metadata; negative-control responses also grew. On this macOS arm64/Bun 1.3.14 run, budgeted positive-query p50 ranged about 0.53–25.04 ms versus unbudgeted 0.43–4.65 ms. The earlier cached-index optimization is separate: token selection performs additional work, not a universal lookup speedup. The retained report includes every raw sample, request/envelope counts, selected distractors and implementation/label digests. RSS readings are sampled process memory, not true peak memory or isolated index size.

The single-encoding tokenizer is bundled for offline Node/Bun execution, with no remote models, native extension or extra installed runtime dependency. A preliminary packed candidate grew from 182,795 to 1,212,976 compressed bytes; final artifact identity must be recorded after final documentation/build checks. The source dependency contains additional encodings, but only the explicitly imported encoding is bundled. Selected Unicode, special-token spelling and JSON token IDs were independently checked against installed official OpenAI `tiktoken 0.13.0`; committed golden vectors keep these checks offline.

### Reproduce

Use clean checkouts at the exact revisions above, without installing or executing their project code. From each checkout run the built Dotdog executable by absolute path with `refresh --json`. Then, from the Dotdog repository after `bun install --frozen-lockfile`:

```sh
bun scripts/benchmark-repositories.ts --repo commander=/absolute/commander --repo typescript-sdk=/absolute/typescript-sdk --output /tmp/dotdog-context-results.json
```

The output must not already exist. `--samples` defaults to 20, with two warm-up requests per mode/case. The harness verifies exact commits and unchanged tracked files. Frozen labels and raw results are in `benchmarks/retrieval/tasks.json` and `benchmarks/retrieval/repository-context.json`. Comparison requests run sequentially in one process; no transport/host latency, model generation, cloud embeddings or VSA backend is measured. CommonJS/workspace-package imports and runtime calls remain outside the extractor's complete coverage. The broader 1.0 performance/integration gates remain open.
