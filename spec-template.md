# SPEC-TEMPLATE

> The map becomes the territory. Specify at sufficient granularity that an AI can predict outcomes before implementation. The spec IS the software.

---

## 1. IDENTITY

What is this thing? Unambiguous name, purpose, boundaries.

```
name: string (unique, kebab-case, permanent)
purpose: string (one sentence — what outcome does this produce in the world?)
scope: string (what is INSIDE this model vs OUTSIDE it?)
anti-scope: string[] (explicitly OUT — prevents scope creep)
version: semver
```

---

## 2. WORLD MODEL

### 2.1 Entities

Every noun in the system. Not "users" — a specific user with properties.

```
entity: <name>
  description: string
  properties:
    <property-name>:
      type: string | number | boolean | enum[...] | entity:<name> | entity:<name>[]
      required: true | false
      default: <value> | null
      constraints: string (min, max, regex, enum values, invariants)
      example: <concrete value>
  states: string[] (valid states this entity can be in)
  lifecycle: <state> -> <state> -> <state> (valid transitions)
  cardinality: "exactly-one" | "zero-or-one" | "zero-or-many" | "one-or-many"
```

### 2.2 Relationships

How entities connect. Every edge is named and constrained.

```
relationship: <entity-a> -> <entity-b>
  verb: string (active: "owns", "calls", "depends on", "contains")
  cardinality: "1:1" | "1:N" | "N:1" | "N:M"
  required: true | false
  cascade: "none" | "delete" | "nullify" | "restrict"
  invariants: string (rules that must always hold)
  example: concrete connection between real instances
```

### 2.3 Events

Things that happen. Every event has a cause, a payload, and consequences.

```
event: <name>
  trigger: string (what causes this event to fire?)
  payload:
    <field>: <type> (data carried by the event)
  preconditions: string[] (what must be true before this event?)
  postconditions: string[] (what becomes true after?)
  side-effects: string[] (what else changes?)
  probability: 0.0-1.0 (likelihood given trigger — null if deterministic)
  frequency: "once" | "per-session" | "per-<time>" | "on-demand"
```

---

## 3. BEHAVIOR

### 3.1 Capabilities

What the system DOES. Each capability is a function with inputs, outputs, and guarantees.

```
capability: <name>
  description: string
  actor: entity (who performs this?)
  inputs:
    <param>: <type> (required | optional, constraints)
  outputs:
    <param>: <type>
  preconditions: string[] (what must be true before calling?)
  postconditions: string[] (what is guaranteed after?)
  error-states: string[] (what can go wrong and how)
  example: concrete input/output pair
```

### 3.2 Constraints

Rules that must ALWAYS hold. Invariants.

```
constraint: <name>
  type: "invariant" | "business-rule" | "physical-limit" | "security" | "compliance"
  statement: string (declarative — "A user's balance can never be negative")
  enforcement: "strict" | "soft" | "eventual"
  violation-consequence: string (what happens if this is broken?)
```

---

## 4. UNCERTAINTY

### 4.1 Assumptions

What we believe to be true. Every assumption has a confidence.

```
assumption: <statement>
  confidence: "certain" | "high" | "medium" | "low" | "speculative"
  basis: string (why do we believe this? data? experience? guess?)
  falsifiable: true | false (can we prove this wrong?)
  test: string (how would we verify or disprove this?)
  if-wrong: string (what changes if this assumption fails?)
```

### 4.2 Probabilities

Where outcomes branch. Explicit probability distributions.

```
outcome-set: <name>
  description: string (what are we predicting?)
  branches:
    <outcome-a>: 0.0-1.0
    <outcome-b>: 0.0-1.0
    <outcome-c>: 0.0-1.0
  basis: string (data, model, expert judgment)
  sensitivity: string (what small change most affects these probabilities?)
```

---

## 5. FAILURE MODES

### 5.1 What breaks?

```
failure: <name>
  description: string (what goes wrong?)
  cause: string (what triggers it?)
  probability: 0.0-1.0
  impact: "critical" | "high" | "medium" | "low"
  detection: string (how do we know it happened?)
  recovery: string (how do we fix it?)
  prevention: string (how do we stop it from happening?)
```

### 5.2 Edge Cases

```
edge-case: <name>
  description: string (specific scenario at the boundary)
  expected-behavior: string (what SHOULD happen?)
  current-behavior: string (what happens now? "unknown" if not implemented)
  test: string (concrete verification)
```

---

## 6. GRANULARITY — the Synecdoche layer

This is where the map becomes the territory. For each entity/capability/event above, specify at the NEXT level down.

```
nest: <parent-entity>.<child>
  <full entity/capability/event/constraint definition at deeper granularity>
```

Repeat until:
- Every property is a concrete value or an enum with all values listed
- Every behavior has all preconditions and postconditions specified
- Every error state is enumerated
- Every assumption is falsifiable
- An AI can simulate the system without asking "but what about...?"

---

## 7. SIMULATION

### 7.1 Scenarios

Concrete what-if scenarios for an AI to walk through.

```
scenario: <name>
  description: string (what situation are we simulating?)
  initial-state: string (what's true at t=0?)
  steps:
    - <event> occurs -> <expected outcome> -> <state change>
    - <event> occurs -> <expected outcome> -> <state change>
  predicted-outcome: string (what should happen at the end?)
  failure-conditions: string (what outcomes mean the model is wrong?)
```

### 7.2 Predictions

What does this model claim will happen? These get tested against reality.

```
prediction: <statement>
  trigger: string (what event starts the clock?)
  timeframe: string (when should this be true by?)
  confidence: 0.0-1.0
  measurement: string (how do we verify this prediction?)
  actual: "pending" | "correct" | "wrong" | "partially-correct"
  notes: string (what did we learn?)
```

---

## 8. EVOLUTION

### 8.1 Version History

```
version: <semver>
  date: ISO date
  changes: string[] (what changed and why?)
  predictions-updated: string[] (which section 7 predictions were wrong?)
```

### 8.2 Open Questions

```
question: <what don't we know?>
  importance: "blocking" | "high" | "medium" | "low"
  owner: string (who is responsible for answering?)
  deadline: ISO date | null
  resolution: string | null (answer once known)
```

---

## AI AGENT INSTRUCTIONS

When an AI agent reads this spec, it should:

1. **Validate** — check all constraints for contradictions, all probabilities sum to 1.0, all states have valid transitions, all relationships are connected to real entities
2. **Simulate** — pick a scenario, walk through each step, report what happens. If the spec is incomplete, say exactly what's missing
3. **Predict** — given current state, forecast the most likely outcomes using the probability tree
4. **Challenge** — flag assumptions with confidence below "high", question untested predictions, identify failure modes with no prevention
5. **Implement** — the spec at sufficient granularity IS implementable. Every entity has concrete properties, every capability has concrete inputs/outputs. If you can't implement directly from this spec, it's not specific enough
