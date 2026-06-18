---
layout: default
title: "Contributing Kits"
description: "How to create, test, and submit dotdog kit templates."
---




## Overview

A kit is a reusable `.dog` spec template. Users run `dotdog kit init <name>` and dotdog copies the kit into `specs/<name>/` so they can start from a complete domain model instead of a blank project.

Built-in kits live in:

```text
packages/dotdog/kits/<name>/
```

Every built-in kit must include:

```text
SPEC.dog
constitution.dog
data-model.dog
```

## File Structure

Use a short lowercase directory name:

```text
packages/dotdog/kits/dao/
  SPEC.dog
  constitution.dog
  data-model.dog
```

`SPEC.dog` describes the product, user flows, screens, and user stories. Keep it concrete enough that a new user can understand what the kit scaffolds.

`constitution.dog` defines rules, constraints, and invariants. These are the promises the generated project should preserve.

`data-model.dog` defines entities, properties, states, lifecycles, and relationships. This file is what agents query most often after `dotdog compile`.

## Writing Entities

Use a heading, a short description, and a fenced YAML block:

````markdown
### Entity: Proposal

A governance proposal that members can vote on.

```yaml
entity: Proposal
type: entity
properties:
  id:
    type: string
    required: true
  title:
    type: string
    required: true
  status:
    type: enum
    required: true
states: [draft, active, passed, rejected, executed]
lifecycle: draft → active → passed → executed
```
````

Rules:

- Match the heading name and `entity:` value exactly.
- Give every entity a one-sentence description.
- Include at least one required property.
- Use explicit `states` and `lifecycle` when the entity changes over time.
- Prefer stable domain names such as `Proposal`, `Vote`, and `Member` over implementation names.

## Writing Relationships

Use the Unicode arrow `→` in relationship headings:

````markdown
### Relationship: Member → Vote

```yaml
relationship: Member → Vote
verb: casts
cardinality: 1:N
required: true
```
````

Rules:

- Both sides must be real entity names in the same kit.
- Relationship names are case-sensitive.
- Use `1:1`, `1:N`, `N:1`, or `N:N` for cardinality.
- Run `dotdog compile` before opening a PR; broken relationships fail compilation.

## Testing a Kit

From the repo root, initialize the kit in a temporary directory:

```bash
tmp=$(mktemp -d)
cd "$tmp"
bun /path/to/dotdog/packages/dotdog/src/cli.ts kit init dao
bun /path/to/dotdog/packages/dotdog/src/cli.ts validate
bun /path/to/dotdog/packages/dotdog/src/cli.ts compile
```

From inside the dotdog repo, run the full test suite too:

```bash
bun test
bun packages/dotdog/src/cli.ts validate
bun packages/dotdog/src/cli.ts compile
```

The CLI test suite initializes every built-in kit and verifies that each generated project contains `SPEC.dog`, `constitution.dog`, and `data-model.dog`, then runs `validate`.

## Pull Request Checklist

- The kit directory name is lowercase and descriptive.
- `SPEC.dog`, `constitution.dog`, and `data-model.dog` are present.
- Every `.dog` file parses.
- `dotdog validate` passes after `dotdog kit init <name>`.
- `dotdog compile` passes after `dotdog kit init <name>`.
- Every relationship points to existing entities.
- The kit uses concrete domain language, not placeholders.
- The PR explains who the kit is for and what starter model it provides.

## Example

See `packages/dotdog/kits/dao/` for a minimal community-governance kit with members, proposals, votes, and treasury allocations.
