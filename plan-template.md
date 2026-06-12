# PLAN-TEMPLATE

> Execution sequence. Phases, repo layout, data flows. How we go from spec to shipped.

---

## Phases

[Divide the work into phases. Each phase is a self-contained milestone.]

### Phase 1: [Name] — [time estimate]

- [ ] [Task]
- [ ] [Task]
- [ ] [Task]

### Phase 2: [Name] — [time estimate]

- [ ] [Task]
- [ ] [Task]

## Repo Layout

```
~/[project]/                          ← [what repo is this?]
├── [dir]/                            ← [what lives here?]
├── [dir]/                            ← [what lives here?]
└── specs/                            ← THIS FOLDER
```

## Data Flows

[How does data move through the system?]

```
User → [Component] → [API] → [Database] → [Response] → [Component] → User
```

## Key Paths

[For specific features, where does the code live?]

```
[directory]/
├── [file.kt]        ← [what to modify]
├── [file.ts]        ← [exists — don't touch]
```

## Deploy

[How does this ship?]

- [ ] [Step]
- [ ] [Step]
- [ ] [Step]

## Verification

[How do we know each phase is done?]

- [ ] [Test/check]
- [ ] [Test/check]
