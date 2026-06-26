---
layout: default
title: "Karpathy's LLM OS Needs a Brain. Here's What That Looks Like."
date: 2026-06-18
author: Justin Diclemente
description: "Andrej Karpathy's LLM OS concept maps agents to an operating system. The missing module? A wiki brain — structured knowledge agents query instead of scan. Here's why flat files fail and entity graphs win."
---

# Karpathy's LLM OS Needs a Brain. Here's What That Looks Like.

Andrej Karpathy gave us the [LLM OS](https://twitter.com/karpathy/status/1723140519554105733) — the idea that large language models are becoming the kernel of a new operating system. Memory is RAM. Tools are I/O devices. Context windows are addressable memory.

But operating systems have a filesystem. Structured directories. Indexed databases. They don't store everything as prose.

Karpathy's LLM OS is missing its brain: a structured knowledge layer that agents can query with precision, not scan with hope.

## The LLM OS Model, Briefly

Karpathy's mental model maps LLMs to operating system components:

- **LLM** = CPU
- **Context window** = RAM
- **Tools** = I/O devices (keyboard, mouse, network)
- **Prompt** = User input
- **Generated text** = Output

It's a brilliant analogy. It explains why agents work the way they do: loading context into RAM, executing tool calls, producing output, flushing memory.

But operating systems have more than CPU, RAM, and I/O. They have filesystems. Databases. Caches. Indexes. Structured data that programs can query without scanning.

Where is the LLM OS's filesystem?

## The Problem: Prose Is Not a Database

Today, agents learn about your project by reading — README files, documentation, source code, issue trackers, Slack threads. They scan prose and guess.

This is like a database reading your diary to find a phone number. Sure, it's in there somewhere. But it's buried in "we should probably call Sarah about the deployment, she mentioned 555-0123 last week and I think she might be traveling but..."

The agent burns 8,000 tokens getting 40 tokens of signal.

The alternative: a **wiki brain** — a structured knowledge graph that lives alongside your codebase. Agents query it with exact lookups, not fuzzy search. They get back entities, properties, states, and relationships. Structured. Typed. Deterministic.

## What a Wiki Brain Looks Like

A wiki brain for a codebase isn't a wiki page. It's a machine-readable graph:

```
Entity: Payment
  Properties: amount (number), currency (string), status (enum)
  States: pending → processing → completed → failed → refunded
  Relationships:
    → Customer: chargedBy
    → Invoice: generates
    → Webhook: triggers

Entity: Customer
  Properties: email (string), display_name (string), preferences (object)
  States: active → suspended → deleted
  Relationships:
    → Payment: initiates
    → Subscription: holds
```

When an agent needs to know how payments work, it doesn't scan 600 lines of documentation. It queries:

```
getEntity("Payment")
→ amount: number, required
→ currency: string, required
→ status: enum[pending, processing, completed, failed, refunded]
→ related to: Customer, Invoice, Webhook
```

That's 40 tokens of output from an exact query — not 8,000 tokens of scanning with 50% hallucination risk.

## Flat Files vs. Knowledge Graphs

The agent internet is building discovery and transport layers: `llms.txt`, ARD catalogs, MCP servers, A2A agents. These are fantastic. But they all describe *what exists* as flat lists.

A wiki brain describes *how things connect* as a graph.

| Approach | Format | Agent Experience |
|----------|--------|-----------------|
| README | Markdown prose | Scans 600 lines, guesses entity names |
| llms.txt | Flat markdown | Scans sections, misses relationships |
| ARD catalog | Flat JSON | Lists endpoints, no entity data |
| **Wiki brain** | **Entity graph** | **Query: getEntity("Payment") → exact data** |

The first three tell agents where to look. The wiki brain tells them what they'll find.

## The Token Math

This matters because context windows aren't free. Every token of prose the agent reads is a token that could have been used for reasoning, tool calls, or output.

A typical project README with architecture docs: ~6,000 tokens.
The same project as a compiled entity graph: ~500 tokens.

That's a **92% reduction**. An agent with a 200K context window can load 400 wiki brains or 33 READMEs. The difference compounds.

## This Isn't New. Databases Solved This in 1970.

Ted Codd published the relational model in 1970 because flat files were unreliable for complex queries. You couldn't guarantee data integrity. You couldn't enforce relationships. You couldn't query with precision.

The agent internet is in its flat-file era. `llms.txt`, `ai-catalog.json`, README files — all flat. Useful. Better than nothing. But not a database.

The wiki brain is the relational model for agents. Entities are tables. Relationships are foreign keys. State machines are constraints. The DAG is the query engine.

## What Karpathy's OS Gets Right — and What's Missing

Karpathy's LLM OS nails the compute model: LLM as CPU, tools as I/O, context as RAM. It explains why agents work the way they do.

What's missing from the diagram: the filesystem. The structured knowledge store. The layer between "I need to understand this codebase" and "let me scan every file."

Add a wiki brain to the LLM OS, and you get:

```
LLM OS with Wiki Brain:

  Applications (agents, copilots, bots)
        ↓
  Tools (MCP servers, APIs, A2A agents)
        ↓
  Wiki Brain (structured entity graph, queryable)
        ↓
  Kernel (LLM, context window, inference)
```

The wiki brain sits between the agent and the codebase. Agents don't scan. They query. They get back structure, not prose.

## The Category Is Emerging

June 2026 is the month this category took shape:

- **June 12**: First structured spec tools ship — entity graphs compilable from human-authored files
- **June 17**: Google announces ARD — discovery layer for the agent internet

The pieces are falling into place. Discovery finds the tool. Transport connects to it. And the wiki brain tells the agent what it's looking at.

Karpathy saw the OS. We're building the filesystem.

---

**Sources:**
- [Karpathy's LLM OS](https://twitter.com/karpathy/status/1723140519554105733), November 2023
- [Google ARD Announcement](https://developers.googleblog.com/en/announcing-the-agentic-resource-discovery-specification/), June 17, 2026
- [llms.txt proposal](https://llmstxt.org/), Jeremy Howard, Sept 2024
- [Codd's Relational Model](https://en.wikipedia.org/wiki/Relational_model), 1970
