# AGENTS-TEMPLATE

> Multi-agent pipeline. Role assignments, code ownership boundaries, handoff protocols.

## Agent Roles

| Agent | Domain | Model | Tools |
|-------|--------|-------|-------|
| **[name]** | [what they own] | [model] | [tools permitted] |
| **[name]** | [what they own] | [model] | [tools permitted] |

## Boundaries

### [Agent Name]

- **Ownership:** [specific directories/files]
- **Mandate:** [what they MUST do]
- **Boundary:** [what they MUST NEVER do]

### [Agent Name]

- **Ownership:** [specific directories/files]
- **Mandate:** [what they MUST do]
- **Boundary:** [what they MUST NEVER do]

## Handoff Loop

```
[Phase 1: Analysis]
  └── [Agent A] → produces [artifact] → hands off to [Agent B]

[Phase 2: Build]
  └── [Agent B] → builds [what] → produces [artifact] → hands off to [Agent C]

[Phase 3: Verify]
  └── [Agent C] → verifies [what] → passes or returns to [Agent B]
```

## Handoff Payload

When [Agent A] hands off to [Agent B]:

1. **Target files:** [exact paths]
2. **Constraints:** [invariants to preserve]
3. **Edge cases covered:** [prioritized list]
4. **Instructions:** [concrete next steps]

When [Agent B] hands off to [Agent C]:

1. **Modified files:** [exact paths]
2. **Platform/modules:** [targets affected]
3. **Verification commands:** [exact commands to run]

## Autonomy Rules

- [Agent B] → [Agent C] handoff is autonomous. No human approval needed.
- [Agent C] failure → [Agent B] includes exact error traces and line numbers.
- Blocked agents escalate to human after [N] retries.
