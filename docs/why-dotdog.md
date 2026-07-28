---
layout: default
title: "Why dotdog"
description: "Compare dotdog with traditional approaches to software specifications."
---




# Why Dotdog exists

Code shows what the system does now. Issues show the next piece of work. Neither reliably explains the product behavior, constraints, data relationships, and implementation reason as one connected model.

That gap matters when a person or AI coding agent must answer questions such as:

- Why does this route exist?
- Which user journey depends on this entity?
- What writes this table?
- Which repository owns the handler?
- What must stay true while the implementation changes?

Dotdog makes those answers explicit and queryable.

## The three layers

| Layer | Owner | Purpose |
|---|---|---|
| `.dog` source | People | Product intent, entities, rules, plans, and reviewed relationships. |
| `.dag` graph | Dotdog | Compact nodes and connections for deterministic tool and agent queries. |
| `.doghouse/` observations | Dotdog | Generated facts describing existing repositories and workspaces. |

The source says what should be true. Repository mapping says what currently exists. Drift checks show where those views stopped matching.

## Why a graph

Long documents are useful for explanation but weak at repeated connection questions. A graph can directly represent:

```text
user journey -> requirement -> task -> file -> route -> handler -> schema -> infrastructure
```

People can inspect that graph with:

```bash
dotdog visualize path/to/project.dag --format html --save
```

AI coding agents can query the same compiled graph through `dotdog serve`. They receive bounded nodes and edges instead of scanning every document and inferring names each time.

## Where it fits

- New product: agree on intent, data, rules, and success before writing the implementation.
- Existing repository: map current code first, then specify the desired change against real files and dependencies.
- GitHub Spec Kit: keep the Specify, Plan, Tasks, and Implement checkpoints, then import the artifacts into a persistent graph.
- Multi-repo product: give services, applications, and infrastructure one product boundary without merging their repositories.

## What it does not replace

Dotdog does not replace source code, tests, pull requests, issues, OpenAPI, or architecture decisions. It connects their meaning. A graph is only trustworthy when people review source intent and automation refreshes observed reality.

Run `dotdog guide` for the short terminal explanation, or follow the [exact workflows](workflows).
