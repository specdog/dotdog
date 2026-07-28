---
layout: default
title: "Tutorial: Spec-Driven Development with dotdog"
description: "Learn how to use dotdog for spec-driven development. Write specs, validate completeness, compile graphs, and expose to AI agents."
---




## Overview

This tutorial walks through building a spec-driven project with dotdog. By the end, you will have a validated spec genome and an MCP server that AI agents can query.

## 1. Install

```bash
npm install -g dotdog
# or
brew tap specdog/dotdog && brew install dotdog
```

Requires Node.js >= 20 or Bun >= 1.3.

## 2. Initialize a project

```bash
dotdog init payment-app --minimal
cd specs/payment-app
```

This creates `SPEC.dog` and `data-model.dog` — the minimum viable spec.

## 3. Write your spec

Open `SPEC.dog` and describe your product:

```markdown
# Payment App

## Product

A simple payment app. Users send money to each other.

### Flow: Send Payment

[1/4] User taps send button
[2/4] User enters amount and recipient  
[3/4] User confirms payment
[4/4] Payment receipt shown

## What the User Sees

### Screen: Send Payment

+------------------------------------------+
|  Send Money                    [Cancel]  |
|                                          |
|  Amount: [$______]                       |
|  To:     [________]                      |
|                                          |
|  [Send]                                  |
+------------------------------------------+

## User Stories

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-01 | Send money to another user | P0 | Payment confirmed, receipt shown |
| US-02 | View payment history | P1 | List of past transactions |
```

## 4. Define your data model

Open `data-model.dog`:

```markdown
# Data Model

## Entities

### Entity: User

A user of the payment app.

```yaml
entity: User
type: entity
properties:
  id:
    type: string
    required: true
  name:
    type: string
    required: true
  balance:
    type: number
    required: true
states: [active, suspended]
lifecycle: active → suspended
```

### Entity: Payment

A payment transaction.

```yaml
entity: Payment
type: entity
properties:
  id:
    type: string
    required: true
  amount:
    type: number
    required: true
  sender_id:
    type: string
    required: true
  recipient_id:
    type: string
    required: true
states: [pending, completed, failed]
lifecycle: pending → completed
```

### Relationship: User → Payment

```yaml
relationship: User → Payment
verb: sends
cardinality: 1:N
required: false
```
```

## 5. Validate

```bash
dotdog validate
```

Expected output:
```
payment-app : 2 .dog files, 85% complete
  SPEC.dog
  data-model.dog
Missing optional: constitution.dog, COPY.dog, plan.dog, DESIGN-SYSTEM.dog, INDEX.dog
```

Fill in the missing files to reach 100%.

## 6. Compile

```bash
dotdog compile
```

Expected output:
```
✓ payment-app.dag
  5 nodes, 2 edges, 2 files
  XXXX → XXX tokens (9X% savings)
```

The `.dag` file is a positional graph — optimized for AI agent consumption.

## 7. Serve to AI agents

```bash
dotdog serve
```

This starts an MCP server over stdio. Configure your AI coding agent:

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Now AI agents can call `getEntity`, `traverse`, and `search` against your spec — zero hallucination.

## 8. See the graph

```bash
dotdog visualize payment-app.dag --format html --save
```

Open `payment-app-graph.html`. Search for a node, click it to highlight direct connections, drag to pan, and scroll to zoom. The file is self-contained and works offline.

## Next steps

- Run `dotdog analyze` for deep gap analysis
- Run `dotdog staleness` to detect spec/reality drift
- Run `dotdog predictions` to track forecasts
- Add more spec files for completeness (constitution.dog, COPY.dog)
- Follow the [existing repository, Spec Kit, or multi-repo workflow](workflows)
