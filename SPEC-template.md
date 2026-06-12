# SPEC-TEMPLATE

> What does this app do? Screens, flows, user stories. Read in 5 minutes.

---

## Product

[One sentence. What does this produce in the world?]

[2-3 sentences. Who is it for? What problem does it solve?]

## What the User Sees

[Every screen. ASCII art. Every pixel the user encounters. Every state.]

```
SCREEN 1: [Name]
┌─────────────────────────────────┐
│                                 │
│   [What's on this screen]       │
│                                 │
└─────────────────────────────────┘

SCREEN 2: [Name]
┌─────────────────────────────────┐
│                                 │
│   [What's on this screen]       │
│                                 │
└─────────────────────────────────┘

SCREEN 3: [Name]
┌─────────────────────────────────┐
│                                 │
│   [What's on this screen]       │
│                                 │
└─────────────────────────────────┘
```

[Repeat for every screen. Include:
- Loading state (spinner, skeleton)
- Empty state (no data yet)
- Error state (what the user sees when something fails)
- Edge case screens (very long names, maximum values)
- Success state (the designed happy path)]

## Flows

[How do users move through the screens?]

```
Flow 1 — [name]:
SCREEN 1 → action → SCREEN 2 → action → SCREEN 3 → done

Flow 2 — [name]:
SCREEN 1 → action → SCREEN 4 → ...
```

## User Stories

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-01 | [As a], I want [action] so that [outcome] | P0 | [Measurable acceptance criteria] |
| US-02 | ... | P1 | ... |

## Architecture

[Diagram showing how pieces connect. Include pre-existing systems.]

```
graph showing:
- What already exists (labeled "Pre-existing")
- What we're building (labeled "Build")
- How they connect
```

## Stack

| Layer | Tech | Why |
|-------|------|-----|
| [Frontend] | [Framework, language] | [Why this choice] |
| [Backend] | [Framework, language] | [Why this choice] |
| [Database] | [Database, version] | [Why this choice] |
| [Infra] | [Services] | [Why this choice] |

## Success Criteria

1. [ ] [Measurable, verifiable]
2. [ ] [Measurable, verifiable]
3. [ ] [Measurable, verifiable]
