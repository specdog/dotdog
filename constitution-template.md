# CONSTITUTION-TEMPLATE

> Immutable rules. If these get violated, the project is broken. Amend with extreme caution.

## Core Principles

1. **[Principle name].** [Statement. Non-negotiable.]
2. **[Principle name].** [Statement. Non-negotiable.]
3. **[Principle name].** [Statement. Non-negotiable.]

## Tech Constraints

| Area | Constraint | Reason |
|------|-----------|--------|
| [Platform/Mobile] | [Constraint] | [Why?] |
| [Database] | [Constraint] | [Why?] |
| [Security] | [Constraint] | [Why?] |
| [Performance] | [Constraint] | [Why?] |

## Dev Workflow

[How the team works.]

- Handoff format: `TXX DONE | what shipped | HANDOFF: exact value`
- Blocked >30 min: escalate. Move to next task. Come back.
- No feature creep. If it's not in SPEC.md → P0, it doesn't ship.

## Governance

This spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.
