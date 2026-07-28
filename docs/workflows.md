---
layout: default
title: "Dotdog workflows: greenfield, existing repositories, and Spec Kit"
description: "Exact Dotdog workflows for new products, existing GitHub repositories, multi-repo products, and GitHub Spec Kit projects."
---

# How to use Dotdog

Dotdog keeps project intent and implementation reality in one queryable graph.

These workflows document the Rust prerelease. Install it from a repository checkout with `cargo install --path crates/dotdog`. The npm package remains stable during cutover verification.

- `.dog` is the source people review: product behavior, entities, rules, plans, and relationships.
- `.dag` is the compiled graph tools query: nodes, connections, and implementation facts.
- `.doghouse/` contains generated repository maps, observations, imports, and workspace graphs.

The point is simple: write down what must be true, map what exists, and let people and AI agents follow explicit connections instead of guessing from scattered Markdown and code.

## Pick your starting point

| Starting point | First command | Use it when |
|---|---|---|
| New product or repo | `dotdog guide greenfield` | You want intent agreed before implementation. |
| Existing GitHub repo | `dotdog guide existing` | You need to understand current code before changing it. |
| GitHub Spec Kit project | `dotdog guide speckit` | You already use Specify, Plan, Tasks, and Implement. |
| Several repositories | `dotdog workspace init` | One product spans services, apps, packages, or infrastructure repos. |

## Greenfield: new product or repository

Run this from the future repository root:

```bash
dotdog init my-product
```

Dotdog creates `specs/my-product/`. Fill the files in this order:

1. `SPEC.dog`: users, problem, behavior, journeys, and success conditions.
2. `data-model.dog`: entities, identifiers, states, and relationships.
3. `plan.dog`: technical approach, phases, and reviewable tasks.
4. `constitution.dog`: rules the implementation cannot violate.
5. `COPY.dog`: interface language people will see.
6. `INDEX.dog`: navigation for the project specification.

Then check the work:

```bash
dotdog validate
dotdog compile
dotdog design --project my-product
dotdog visualize specs/my-product/my-product.dag --format html --save
```

Open `specs/my-product/my-product-graph.html`. It is a self-contained map: drag to pan, scroll to zoom, search nodes, and click a node to highlight its direct connections.

Start the MCP server for an AI coding agent:

```bash
dotdog serve
```

During implementation, work one task at a time. If product intent changes, update the source specification. If only the implementation changes, update the plan or repository map. Re-run `validate` and `compile` before review.

## Existing GitHub repository

Clone the repository and run Dotdog from its root:

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
dotdog map
```

`map` observes repository structure and writes graph artifacts under `.doghouse/`. Inspect the result:

```bash
dotdog query repository --dag .doghouse/compiled/repo.dag
dotdog visualize .doghouse/compiled/repo.dag --format html --save
dotdog serve
```

Now describe the change you want:

```bash
dotdog init feature-name
```

In `specs/feature-name/SPEC.dog`, write both current and desired behavior. Include affected users, constraints, failure cases, and measurable success. Then run:

```bash
dotdog validate
dotdog compile
dotdog design --project feature-name
```

Implement one focused change. Re-run `dotdog map` when repository structure changes. Re-run `dotdog compile` when specification intent changes. The useful connection is:

```text
product reason -> feature -> task -> file -> route -> handler -> schema -> infrastructure
```

## GitHub Spec Kit

[GitHub Spec Kit](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) provides the development checkpoints: Specify, Plan, Tasks, and Implement. Dotdog imports those reviewed artifacts into a graph that stays queryable during implementation.

From the Spec Kit repository root:

```bash
dotdog speckit import .
dotdog compile .doghouse/speckit
dotdog visualize .doghouse/speckit --format html --save
dotdog serve .doghouse/speckit
```

Generated files are managed by an import manifest. Re-running the importer updates unchanged generated files and preserves files a person edited. Use `--force` only when you intentionally want generated output to replace local edits.

## Product spanning several repositories

Create the workspace in the product root:

```bash
dotdog workspace init --id my-product --name "My Product"
dotdog workspace add ../api --alias api --role api
dotdog workspace add ../web --alias web --role web
dotdog workspace add ../infra --alias infra --role infrastructure
dotdog workspace validate
dotdog workspace graph
```

Then observe and query the product boundary:

```bash
dotdog observe
dotdog ask "which files define routes?"
dotdog drift
dotdog serve
```

## What belongs in Git

- Commit human-reviewed `.dog` source.
- Commit `.doghouse/workspace.json` for multi-repo product membership.
- Commit stable `.dag` output only when the team wants agents to query it without rebuilding.
- Review `.doghouse/` generated output before committing it because it can describe repository internals.
- Do not commit the generated interactive HTML map unless it is an intentional documentation artifact.

## Daily loop

```text
Specify what must be true
  -> validate missing decisions
  -> compile the graph
  -> inspect node connections
  -> implement one task
  -> map or observe reality
  -> check drift
```

Use `dotdog guide` in the terminal whenever you need the short version.
