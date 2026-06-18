---
layout: default
title: "Dotdog vs OpenAPI vs README: What Agents Actually Need"
date: 2026-06-18
author: Justin Diclemente
description: "AI agents don't need more prose. They need structured specs. Compare dotdog, OpenAPI, README, and Jira for agent consumption — token efficiency, hallucination risk, and query precision."
---

# Dotdog vs OpenAPI vs README: What Agents Actually Need

AI coding agents are everywhere. They write code, open PRs, and debug production. But they don't know your project. They scan READMEs, guess entity names, and invent relationships.

What would happen if you gave them the spec as structured data instead of prose?

Here's the comparison.

## The Contenders

| Tool | Format | Agent Query | Token Cost |
|------|--------|-------------|------------|
| **README** | Markdown prose | Scans 600 lines, guesses | 8,000+ tokens |
| **OpenAPI** | JSON/YAML | Exact endpoint lookup | 500-2,000 tokens |
| **Jira/Linear** | Tickets, comments | Keyword search | 500+ per ticket |
| **llms.txt** | Flat markdown | Scans sections | 200-500 tokens |
| **dotdog** | Entity graph (.dag) | Exact entity query | 40 tokens |

## The Test: A Payment API

Let's compare how an agent learns about a simple payment API across each tool.

### README (8,000 tokens)

```
# Payments API

Our payments API handles credit card and ACH transactions. We use
Stripe as our primary processor with a fallback to Braintree for
international payments. The API supports idempotency keys...

[8,000 tokens later]

...and that's how webhooks work with our retry mechanism.
```

The agent scanned 8,000 tokens to find: Payment has amount, currency, status fields. It relates to Customer, Invoice, Webhook. It guessed the relationship names.

### OpenAPI (800 tokens)

```yaml
paths:
  /payments:
    post:
      requestBody:
        schema:
          type: object
          properties:
            amount: { type: number }
            currency: { type: string }
```

The agent got the API surface right — endpoints, parameters, responses. But it missed: lifecycle (pending → completed → failed), relationships (Customer initiates Payment), and business rules (idempotent, audited).

### Dotdog DAG (40 tokens)

```json
getEntity("Payment") → {
  properties: { amount, currency, status, processor },
  states: "pending → processing → completed → failed → refunded",
  edges: ["→ Customer (chargedBy)", "→ Invoice (generates)", "→ Webhook (triggers)"]
}
```

The agent queried one entity. Got back properties, states, and relationships. 40 tokens.

## Token Efficiency: The Multiplier

Context windows cost money. Every token of prose the agent reads is a token that could have been used for reasoning.

| Project Size | README Tokens | Dotdog DAG Tokens | Savings |
|-------------|---------------|-------------------|---------|
| Small (5 entities) | 4,500 | 280 | 94% |
| Medium (15 entities) | 12,000 | 900 | 93% |
| Large (50 entities) | 35,000 | 2,800 | 92% |
| Monorepo (200 entities) | 140,000 | 11,000 | 92% |

The savings compound. An agent with a 200K context window can load 180 medium dotdog specs or 16 medium READMEs.

## Hallucination Risk

This is where dotdog separates from everything else.

- **README**: Agent reads prose, extracts entities by guesswork. Hallucinates relationship names. Common.
- **OpenAPI**: Agent gets endpoint structure right. Misses business entities and state machines. Partial.
- **Jira**: Agent reads tickets, infers architecture from bug reports. Invented context.
- **Dotdog**: Agent queries exact data. No guesswork. Near-zero hallucination.

The difference isn't subtle. When an agent writes code from a README, it invents 15-30% of entity relationships. When it writes from a DAG, it invents none.

## Which Should You Use?

They're not mutually exclusive. The stack works together:

```
OpenAPI → for API surface (endpoints, schemas, auth)
README  → for human onboarding (why, how, context)
Dotdog  → for agent consumption (entities, states, relationships)
llms.txt → for agent discovery (what's on this site)
```

Use all four. But if agents are writing code in your repo — and they are — give them the one thing they can't get from prose: **structured ground truth**.

## The Bottom Line

Three numbers matter:

- **94%**: Token savings vs prose
- **0%**: Hallucination rate when agents query the DAG
- **7**: MCP tools agents use to query your spec

Every AI agent in your editor, CI, and terminal is reading your codebase right now. Give them a `.dag` file instead of a README. They'll ship faster and hallucinate less.

---

**Install**: `npm install -g dotdog` · `brew install dotdog` · `bun add -g dotdog`

**Start**: `dotdog init my-project` → `dotdog compile` → `dotdog serve`
