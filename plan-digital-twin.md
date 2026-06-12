# plan: digital-twin-spec-system

> Status: plan (not building yet)
> Owner: Justin
> Created: 2026-06-12

## What this is

A spec system that IS the software. Not "spec then build" — the specification at sufficient granularity becomes a living digital twin that an AI can simulate, predict, and act upon.

Palantir calls theirs an "Operational Layer / Digital Twin." We're building the open-source, personal-scale version. Same architecture. Different scale.

## Prior Art — who's already doing this

### Reference implementation: CryptChat specs/ (ours)
The spec genome approach was proven at ETHGlobal NYC 2026. 20+ spec files covering every dimension of the project:

| File | Dimension | Real example |
|------|-----------|-------------|
| SPEC.md | Product, screens, flows | ASCII art of every screen, every state |
| constitution.md | Immutable rules | "E2EE is non-negotiable. Signal protocol." |
| data-model.md | Structs, events, types | Solidity structs, protobuf messages, Kotlin data classes |
| COPY.md | Every UI string | "Send Money", "Pay", "Insufficient USDC" |
| DESIGN-SYSTEM.md | Tokens, primitives, components | 5-layer architecture (tokens → screens) |
| VISUAL-DIRECTION.md | Visual philosophy | 1990s Wall Street, bone white, ledger green |
| COMPOSE-MAP.md | Design→code mapping | Pixel UI → M3 Compose SDK components |
| plan.md | Execution sequence | Phases, repo layout, data flows |
| tasks.md | Task dependencies | T01-T17 with handoffs |
| tasks/AGENTS.md | Multi-agent pipeline | BA→router→coders→QA with strict handoffs |
| research.md | Decision rationale | Why each architectural choice |
| PITCH.md | Stage script | 3-min pitch + judge Q&A |
| BACKLOG.md | Deferred features | Stretch goals |
| COMPAT.md | Device compatibility | What works where |
| INDEX.md | Reading paths | Different paths for different audiences |

This is the real "world encyclopedia." Every question about the project has a file that answers it. An AI agent can read all of them and build the entire system.

### Palantir Foundry Ontology
The gold standard. Three layers:

| Layer | What it is | Our equivalent |
|--------|------------|-----------------|
| **Semantic** (Nouns) | Object Types, Properties, Link Types — what EXISTS | Section 2: World Model (Entities + Relationships) |
| **Kinetic** (Verbs) | Actions, Functions, Dynamic Security — what HAPPENS | Section 3: Behavior + Section 2.3: Events |
| **Dynamic** (Time) | Streaming data, time-series properties, real-time updates — what CHANGES | **Missing from template** |

Key difference: Palantir's ontology is backed by live data pipelines. Every property has a source system, ingestion cadence, and data lineage. Our spec template captures the shape but not the plumbing.

### Second Me (mindverse/Second-Me)
Open-source AI digital twin. Personal memory offloading. Key concepts:
- **Lifelong Personal Model** — learns your style, remembers context, can act on your behalf
- **AI-Native Memory** — parameterized training, not just vector search
- **Local-first** — runs on your machine, privacy-preserving
- **Limitation**: Focused on identity/communication, not domain knowledge. Doesn't do predictive simulation.

### LSDTs (LLM-Augmented Semantic Digital Twins)
Academic research (arxiv 2508.06799). Uses LLMs to build and maintain semantic ontologies for digital twins. Key insight: LLMs can auto-generate ontology from natural language. Our spec IS the natural language input — LSDT closes the loop by having the AI build the ontology from the spec.

### Digital Twin Consortium / IDTA
Industrial standard (Asset Administration Shell). Too heavy for personal use but the spec format (submodels, properties, operations) mirrors what we need.

### Raw Knowledge Graphs
Projects like logseq, Obsidian, Roam — personal knowledge graphs without the predictive layer. They capture what you know, not what will happen.

### None of them do what we want
- Palantir: Enterprise, closed, $millions
- Second Me: Identity-focused, not domain modeling
- LSDT: Academic, not productized
- Knowledge graphs: Static, no prediction
- Our spec: Open-source, personal-scale, three-layer architecture, predictive simulation

---

## Architecture

### Three-Layer Model (Palantir-inspired)

```
┌─────────────────────────────────────────────┐
│              SEMANTIC LAYER                  │
│              (Nouns — What is)               │
│                                              │
│  Object Types ─── Properties ─── Links       │
│  (entities)       (attributes)  (relations)  │
│                                              │
│  Examples:                                    │
│    Person.justin knows Person.eric            │
│    Project.cryptchat has Component.wallet     │
│    Material.oak costs $285/linear-meter       │
│                                              │
│  Every object has:                            │
│    - Unique ID                                │
│    - Typed properties with constraints        │
│    - State + lifecycle                        │
│    - Data provenance (source, timestamp,      │
│      confidence)                              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              KINETIC LAYER                    │
│              (Verbs — What happens)           │
│                                              │
│  Actions ─────── Functions ──── Security      │
│  (modify state)  (compute)      (who can)     │
│                                              │
│  Examples:                                    │
│    action: "assign material to cabinet"        │
│      pre: cabinet.state = proposed            │
│      post: cabinet.material = material.id     │
│      guard: user.role = designer              │
│                                              │
│    function: "calculate total cost"            │
│      input: project.id                        │
│      output: number (USD)                     │
│      logic: sum(cabinet.material.cost         │
│              * cabinet.width / 1000)          │
│                                              │
│  Every action has:                            │
│    - Preconditions (what must be true)         │
│    - Postconditions (what becomes true)       │
│    - Side effects (what else changes)         │
│    - Authorization (who can trigger)          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              DYNAMIC LAYER                    │
│              (Time — What changes)             │
│                                              │
│  Time-Series ─── Streams ──── Pipelines      │
│  (history)       (live)      (ingestion)     │
│                                              │
│  Examples:                                    │
│    material.cost over time:                   │
│      2024-01: $245                           │
│      2025-06: $285                           │
│      2026-01: $310                           │
│    → prediction: 2026-12: $335               │
│                                              │
│    project.installer-revision-rate:            │
│      live feed from installer app             │
│      triggers alert if > 15%                 │
│                                              │
│  Every time-series has:                       │
│    - Source pipeline (where data comes from)  │
│    - Update cadence (realtime/hourly/daily)   │
│    - Retention policy                         │
│    - Anomaly detection threshold              │
└─────────────────────────────────────────────┘
```

### The Spec IS the System

Traditional: `spec.md → developer reads → writes code → software exists`

Synecdoche model: `spec.md → AI parses → AI validates → AI simulates → AI implements → software exists`

At each layer:
1. Write spec in markdown using the template
2. AI agent reads spec and constructs internal ontology
3. AI validates constraints, checks completeness, flags contradictions
4. AI simulates scenarios and reports predicted outcomes
5. AI generates implementation (database schema, API, UI components)
6. Implementation feeds data back into spec's Dynamic Layer
7. Spec updates with real data, predictions get tested, confidence adjusts

This is the Synecdoche loop: the spec generates the software, the software generates data, the data refines the spec, the spec gets more granular, repeat.

---

## Phases

### Phase 0: Template Upgrade
**Now. Today.**

Update `spec-template.md` with the three-layer architecture:
- Add Dynamic Layer section (time-series, pipelines, provenance)
- Add data provenance to Entity properties (source, confidence, timestamp)
- Add ontology inheritance (Entity types can extend other types)
- Add access control (who can read/write/modify each entity)
- Add cross-spec references (spec A references entity types from spec B)
- Add pipeline links (where does data for each property come from?)

### Phase 1: Spec Validator
**Tool that reads a spec and validates it.**

- Parses markdown into structured ontology
- Checks all constraints for contradictions
- Verifies all probabilities sum to 1.0
- Validates all states have valid transitions
- Checks all relationships reference real entities
- Flags missing required sections
- Output: validation report (errors, warnings, completeness score)

This is a Python script that sits in the spec repo. Run it like `python3 validate.py magic-cabinet-kitchen-layout.spec.md` and it tells you what's wrong.

### Phase 2: Simulation Engine
**Tool that runs scenarios from the spec.**

Takes a spec + a scenario name, walks through step by step:
1. Load initial state from spec
2. Apply each step's event
3. Check preconditions, apply postconditions, trigger side effects
4. Report state changes at each step
5. At end, compare predicted outcome to spec's prediction
6. Flag any "unknown" behavior (the spec didn't specify what happens)

This is a Python state machine engine. The spec IS the input. No hardcoded logic — everything comes from the spec.

### Phase 3: Live Data Backend
**Connect the Dynamic Layer to real data.**

- SQLite/Postgres database auto-generated from spec entities
- REST API auto-generated from spec actions
- Time-series ingestion from spec pipeline definitions
- Prediction tracking: spec predictions get tested against real outcomes
- Dashboard: "Here's what you predicted. Here's what actually happened. Your hit rate is X%."

### Phase 4: AI-Native Copilot
**Hermes Agent reads your specs and reasons about them.**

- AI agent loads a spec and can answer: "What breaks if we change X?"
- AI agent proposes spec changes: "Your prediction about material lead times was wrong. Here's an updated probability tree based on actual data."
- AI agent synthesizes across specs: "CryptChat's wallet spec and Magic Cabinet's payment spec have conflicting assumptions about transaction finality."
- AI agent is the "AI FDE" — it builds the ontology from natural language, creates branches, proposes merges

### Phase 5: Personal Digital Twin
**A spec about YOU. Your knowledge, decisions, predictions.**

This is the "second self." A `justin.spec.md` that encodes:
- What you know (domain expertise, facts, heuristics)
- How you decide (decision trees, priorities, constraints)
- What you predict (market moves, project outcomes, team dynamics)
- Your track record (which predictions were right, which were wrong)

An AI reading `justin.spec.md` can:
- Simulate how you'd respond to a situation
- Predict which projects you'd greenlight
- Identify your blind spots (where your predictions consistently fail)
- Scale your decision-making (apply your heuristics to 100x more decisions)

This isn't a chatbot. It's a predictive model of your mind.

---

## What changes in the spec template

Current template sections → Three-layer mapping:

| Template Section | Layer | Status |
|---|---|---|
| 2.1 Entities | Semantic | Has types, properties, constraints, states, lifecycle |
| 2.2 Relationships | Semantic | Has cardinality, cascade, invariants |
| 2.3 Events | Kinetic | Has trigger, payload, pre/postconditions, side-effects, probability |
| 3.1 Capabilities | Kinetic | Has inputs, outputs, pre/postconditions, error-states |
| 3.2 Constraints | Semantic+Kinetic | Has invariants, enforcement level |
| 4.1 Assumptions | Semantic | Has confidence, basis, falsifiability |
| 4.2 Probabilities | Kinetic | Has outcome trees, basis, sensitivity |
| 5.1 Failures | Kinetic | Has cause, probability, impact, detection, recovery |
| 5.2 Edge Cases | Kinetic | Has expected behavior, test |
| 6. Granularity | Semantic | Recursive entity nesting |
| 7.1 Scenarios | Kinetic | Has initial state, steps, predicted outcome |
| 7.2 Predictions | Dynamic | Has trigger, timeframe, actual vs predicted — **good start** |
| 8. Evolution | Dynamic | Version history — **needs expansion** |

**New sections needed:**

```
2.4 Data Provenance
  For every entity property: where did this value come from?
  - source: string (database, API, user input, manual, derived)
  - confidence: 0.0-1.0 (how certain is this value?)
  - last-updated: ISO timestamp
  - update-cadence: "realtime" | "hourly" | "daily" | "weekly" | "manual"
  - pipeline: string (name of ingestion pipeline, if automated)

2.5 Ontology Inheritance
  Entity types can extend other entity types.
  - Cabinet extends Furniture
  - SinkBase extends Cabinet
  - Inherited properties are implicit, not redeclared
  - Child types can override constraints (narrower, not wider)

3.3 Access Control
  Who can do what to which entities?
  - role: string (admin, designer, installer, customer, viewer)
  - permissions:
      entity: string (or "all")
      read: true | false
      write: true | false
      delete: true | false
      conditions: string (row-level — "only projects assigned to this user")

3.4 Cross-Spec References
  Specs form a graph. This spec references entities from other specs.
  - spec: string (path to another spec)
  - entity: string (entity name in that spec)
  - relationship: string (how this spec uses that entity)
  - freshness: string (how often this reference should be revalidated)

6.5 Time-Series Properties (Dynamic Layer)
  Properties that change over time.
  - entity.property: string
  - history: [{value, timestamp, source}]
  - trend: "stable" | "increasing" | "decreasing" | "volatile" | "unknown"
  - projection: {value, timestamp} (forecasted future value)
  - anomaly-threshold: number (standard deviations before alerting)

6.6 Ingestion Pipelines
  How live data flows into the spec.
  - pipeline: string (unique name)
  - source: string (database connection, API endpoint, webhook, file)
  - target: string (entity.property this pipeline feeds)
  - schedule: string (cron expression or "realtime")
  - transform: string (what processing happens to raw data?)
  - failure-mode: "halt" | "skip" | "retry" | "alert"
```

---

## Who's already doing this — deeper dive

| Project | What | Overlap | Gap |
|---------|------|---------|-----|
| **Palantir Foundry** | Enterprise ontology with 3-layer architecture | Architecture we're cloning | Closed source, $millions, enterprise scale |
| **Second Me** (mindverse) | Personal AI twin — memory, identity, style | Personal-scale, open source | Identity not domain knowledge, no predictive layer |
| **LSDT** (academic) | LLM-built semantic digital twins | AI constructs ontology from natural language | Research only, no product |
| **Asset Administration Shell** (IDTA) | Industrial digital twin standard | Formal spec for entities, properties, operations | Industrial, heavy, not personal |
| **Notion + AI** | Document-based knowledge with AI query | Accessible, personal | No ontology, no simulation, no predictive model |
| **Logseq/Obsidian** | Personal knowledge graph | Local-first, linked thinking | Static, no action layer, no time-series |
| **Causal** (causal.app) | Spreadsheet for probabilistic modeling | Probabilities, scenarios, what-if | Financial focus, no entity graph |
| **Guesstimate** | Monte Carlo simulation tool | Uncertainty modeling | No ontology, no data pipeline |
| **HASH** (hash.ai) | Agent-based simulation platform | Multi-agent simulation | Academic focus, not personal |
| **Our spec template** | Markdown spec → AI reads → simulates → implements | All of the above, personal scale, open source | Everything needs building |

---

## Decision

Build it. Start with Phase 0 (template upgrade) right now, Phase 1 (validator) next session.

The spec template upgrade adds the missing Palantir layers without requiring any code. Just the format — the AI can work with it immediately. The validator makes it machine-verifiable. Each phase compounds.

The end state: `~/spec/` contains `.spec.md` files for every domain you care about. An AI agent loads them, simulates outcomes, predicts failures, and flags when your assumptions are wrong — all from markdown files anyone on the team can read.

The spec IS the digital twin.
