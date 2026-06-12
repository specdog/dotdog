# DATA-MODEL-TEMPLATE

> Exact structs, events, types. No ambiguity. Copy-pastable into code.

## Entities

[For each entity in the system:]

```solidity
// Example: Smart contract struct
struct [Name] {
    [type] [field];           // [what this field is]
    [type] [field];           // [what this field is]
}
```

```typescript
// Example: SDK type
interface [Name] {
  [field]: [type];            // [what this field is]
  [field]: [type];            // [what this field is]
}
```

```kotlin
// Example: Mobile data class
data class [Name](
    val [field]: [Type],      // [what this field is]
    val [field]: [Type],      // [what this field is]
)
```

## Events

[What events can fire in the system?]

```
event [Name](
    [type] [field],           // [what data the event carries]
    [type] [field]
)
```

## States and Transitions

[What states can entities be in? What transitions are valid?]

```
[Entity]:
  draft → submitted → verified → active
  [active → suspended → active]
  [active → archived]
```

## Flows

[Sequence diagrams for key interactions.]

```
sequence: [Name]
  Participant A → Participant B: [Action]
  Participant B → Participant C: [Action]
  Participant C → Participant B: [Response]
  Participant B → Participant A: [Response]
```

## API Contract

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | /[endpoint] | [auth method] | [shape] | [shape] |
