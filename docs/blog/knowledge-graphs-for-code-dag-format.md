---
layout: default
title: "Knowledge Graphs for Code: The .dag Format"
date: 2026-06-17
author: Justin Diclemente
description: "DAGs compress project specs into queryable graphs. Here's how the format works."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Knowledge Graphs for Code: The .dag Format

A DAG is a directed acyclic graph. In dotdog, it's the compiled output of your spec files — every entity, relationship, state, and property encoded as nodes and edges.

Why a DAG? Because your project's dependencies form a DAG. Tasks depend on tasks. Entities reference entities. Compilation produces the graph. Nothing is circular.

## From prose to nodes

Your spec has entities:

```
Entity: User
  properties:
    email: string!
    password: string!
  states: [active, suspended]
```

The DAG encodes this as a node:

```
[0, "User", "entity", "...", [["email","s!"], ["password","s!"]], ["active","suspended"], [...]]
```

Positional arrays. No repeated keys. 94% smaller than the source YAML. The LLM doesn't parse JSON — it pattern-matches on the positional structure.

## Edges encode relationships

```
Relationship: Task → User
  verb: assigned_to
  cardinality: N:1
```

Becomes an edge:

```
[target_id, "assigned_to", "N:1", false]
```

The edge lives on the source node. Traversal is one hop: Task → User. The agent calls `traverse("Task", 1)` and gets everything Task connects to.

## V2 positional format

The original DAG used named keys (`"name": "User"`). V2 drops the keys:

```
Old: {"name": "User", "type": "entity", "properties": {"email": "s!"}}
New: [0, "User", "entity", "...", [["email","s!"]], [...], [...]]
```

Same information. Half the tokens. Every node is an array at a known index. The LLM reads position 1 for the name, position 5 for states, position 6 for edges. No scanning through keys.

## Why graphs beat documents

A document is linear. You scan it top to bottom. A graph is spatial — you traverse from any node to any connected node.

When an agent needs to know "what depends on User," a document requires scanning every line for "User." A graph requires one traversal: `traverse("User", 1) → [Task, Payment, Session]`.

The DAG is the agent's index. It doesn't read your specs. It queries the graph.

## Token economics

```
7 .dog files: 12,000 tokens (prose, YAML, repetition)
1 .dag file:   739 tokens (positions, no keys, no comments)
```

The agent loads 739 tokens instead of 12,000. Every query is a graph traversal. Every answer is deterministic.

---

*[dotdog](https://github.com/specdog/dotdog) — write .dog, compile .dag, query via MCP. 94% smaller. 0% hallucination.*

## References

- **Knowledge Graphs in Software**: Liu et al. "Software Knowledge Graph: A Survey." arXiv:2306.13382, 2023. Comprehensive survey of knowledge graph applications in software engineering.
- **Positional Encoding**: Vaswani et al. "Attention Is All You Need." NeurIPS 2017. Positional encodings eliminate repeated keys — same principle behind v2 DAG format.
- **Token Economics**: dotdog dogfood data. specs/dotdog/dotdog.dag, v0.7.0. Verified: 7 .dog files (9,463 source tokens) → 1 .dag (398 dag tokens) = 95.8% savings.
