# SPEC — Spec Platform (the product)

> A spec genome platform. Teams write specs. Platform validates, simulates, and generates code. AI agents query specs at build time via MCP. Sell as SaaS.

---

## Product

Teams define their software using a spec genome. The platform validates that the spec is complete and consistent, simulates scenarios to predict outcomes, and generates production-ready code scaffolding. AI coding agents (Claude Code, Cursor, Copilot, Hermes) query specs in real-time via MCP.

One source of truth. Zero ambiguity. Ship with confidence.

## What the User Sees

### Flow 1: Team writes specs (Dashboard)

```
DASHBOARD
┌──────────────────────────────────────────────────────────┐
│  Spec Platform                                    [Settings] │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ 3 Projects  │  │ 87% Complete │  │ 2 Predictions │   │
│  │ active      │  │ avg across   │  │ verified this │   │
│  │             │  │ projects     │  │ week          │   │
│  └─────────────┘  └──────────────┘  └───────────────┘   │
│                                                         │
│  Projects                                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │ CryptChat                   12 specs  ● complete   │ │
│  │ last updated 2h ago         3 predictions pending  │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Magic Cabinet               8 specs   ◐ 87%       │ │
│  │ last updated 1d ago         1 constraint violated  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  [+ New Project]                                        │
└──────────────────────────────────────────────────────────┘
```

### Flow 2: AI agent queries specs (MCP)

```
┌─ Developer in Cursor ──────────────────────────────┐
│                                                     │
│  User: "Build the payment bubble component"         │
│                                                     │
│  AI Agent → MCP Server:                             │
│    → getSpec("cryptchat", "SPEC.md")                │
│    → getSpec("cryptchat", "COPY.md")                │
│    → getSpec("cryptchat", "DESIGN-SYSTEM.md")       │
│    → getSpec("cryptchat", "COMPOSE-MAP.md")         │
│                                                     │
│  AI Agent has:                                       │
│    - Exact screen layout (ASCII art)                │
│    - Every UI string ("💰 {sender} sent ${amount}") │
│    - Token values (green #1F4D2B)                   │
│    - Compose mappings (CCPaymentBubble.kt)          │
│                                                     │
│  AI Agent builds the component. Zero ambiguity.     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Flow 3: Validation runs

```
┌─ CLI ───────────────────────────────────────────────┐
│                                                     │
│  $ spec validate                                     │
│                                                     │
│  ✓ constitution.md — 5 principles, 0 violations     │
│  ✓ data-model.md — 12 entities, 8 events            │
│  ✓ SPEC.md — 7 screens, all states covered          │
│  ✓ COPY.md — 48 strings, 0 placeholders             │
│  ⚠ COPY.md — missing error state for "Send Money"   │
│  ⚠ data-model.md — PaymentReceipt.tx_hash nullable? │
│  ✗ SPEC.md — Screen 4 references "alice.eth" but    │
│     COPY.md uses "{displayName}" — inconsistency    │
│                                                     │
│  3 warnings, 1 error. Fix before proceeding.        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Flow 4: Simulation runs

```
┌─ CLI ───────────────────────────────────────────────┐
│                                                     │
│  $ spec simulate cryptchat --scenario "payment"      │
│                                                     │
│  Scenario: Sender pays $1.00 to alice.eth            │
│                                                     │
│  [1/6] User taps "$" button                         │
│    → UI state: AmountSheet visible ✓                 │
│    → Validation: recipient exists ✓                  │
│                                                     │
│  [2/6] User types "1.00" and taps "Pay"             │
│    → Amount parsed: 1.00 ✓                           │
│    → POST /pay → 402 Payment Required ✓              │
│                                                     │
│  [3/6] Face ID prompt appears                        │
│    → PasskeySigner invoked ✓                          │
│    → userVerification: required ✓                     │
│                                                     │
│  [4/6] User authenticates                           │
│    → EIP-3009 signature generated ✓                   │
│    → POST /pay + PAYMENT-SIGNATURE ✓                  │
│                                                     │
│  [5/6] Facilitator settles USDC                      │
│    → Base Sepolia: transfer confirmed ✓               │
│    → tx_hash: 0xd4e5f6... ✓                           │
│                                                     │
│  [6/6] Payment receipt delivered                     │
│    → PaymentReceipt encrypted (libsignal) ✓           │
│    → Recipient sees "💰 bob sent $1.00" ✓             │
│                                                     │
│  RESULT: Success (6/6 steps passed)                  │
│  Predicted: layout-revision-rate = 0.10              │
│  Time estimate: 22 seconds (within 30s budget)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## User Stories

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-01 | Create a project and upload spec files | P0 | Project created, files indexed, reading paths generated |
| US-02 | Validate a project for completeness and consistency | P0 | All constraints checked, cross-references verified, report generated |
| US-03 | AI agent queries spec via MCP server | P0 | MCP tool `getSpec` returns exact file content with metadata |
| US-04 | AI agent searches across specs via MCP | P0 | MCP tool `searchSpecs` returns matches across all project files |
| US-05 | Simulate a scenario from SPEC.md | P1 | All steps executed, pre/postconditions checked, outcome reported |
| US-06 | Track predictions against reality | P1 | Prediction created, actual outcome recorded, hit rate calculated |
| US-07 | Generate code scaffold from spec genome | P1 | Spec files → database schema, API routes, component stubs |
| US-08 | Team dashboard with project overview | P2 | Multiple projects, completeness scores, active predictions |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    spec-platform                      │
│                                                      │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │ MCP      │  │ CLI              │  │
│  │ (web)     │  │ Server   │  │ spec validate    │  │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│        │             │                │             │
│        └─────────────┼────────────────┘             │
│                      │                              │
│              ┌───────▼────────┐                     │
│              │  spec-api      │                     │
│              │  (REST)        │                     │
│              └───────┬────────┘                     │
│                      │                              │
│              ┌───────▼────────┐                     │
│              │  spec-engine   │                     │
│              │  (core logic)  │                     │
│              │                │                     │
│              │  parse → ontology → validate → sim  │
│              └───────┬────────┘                     │
│                      │                              │
│              ┌───────▼────────┐                     │
│              │  spec-db       │                     │
│              │  (SQLite/Postgres)                   │
│              └────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

## Stack

| Layer | Tech | Why |
|-------|------|-----|
| Core Engine | TypeScript | One language across API, MCP, codegen. Runs on Node/Bun/Deno. |
| API | Elysia (Bun) | Fast, TypeScript-native, OpenAPI auto-gen |
| MCP Server | @modelcontextprotocol/sdk | Standard protocol. Works with Claude, Cursor, Copilot, Hermes. |
| Dashboard | React + Vite | Fast build, small bundle, no framework lock-in |
| Database | SQLite (embedded) → Postgres (cloud) | Start local, scale to cloud. Same schema. |
| CLI | Node.js + Commander.js | Zero-dependency install, single binary target |
| Codegen | AST transforms + templates | Reads spec ontology, outputs typed code |
| Sim Engine | TypeScript state machine | Pure functions. Spec → execution graph. |

## Constraints

- Monorepo. One `pnpm-workspace.yaml`. Shared types.
- SQLite for local/offline. Postgres for cloud. Same Prisma schema.
- MCP server must work with Claude Code, Cursor, Copilot, Hermes — not just one.
- CLI must install via `npm install -g spec-platform` with zero additional deps.
- The platform IS dogfooded. `specs/` in this repo uses our own format.
- Free tier: 1 project, local-only, full features. Paid: teams, cloud, predictions.

## Success Criteria

1. [ ] `spec validate` runs on CryptChat specs and produces a report
2. [ ] MCP server returns `getSpec("cryptchat", "COPY.md")` in under 50ms
3. [ ] CLI installs with `npm install -g` on macOS, Linux, Windows
4. [ ] Simulation runs a 6-step scenario and reports correct outcome
5. [ ] Dashboard shows project list with completeness scores
6. [ ] Codegen produces a working React component from DESIGN-SYSTEM.md
