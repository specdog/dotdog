# dotdog — Product Plan

> Derived from spec-platform: 5 entities, 5 relationships.

## State

spec-platform dogfoods dotdog: 5 entities (Node, Task, Prediction, Compile, DAG). Validates at 95%+. Compiles to .dag. Simulates successfully.

## Phase 1 — Predictive milestones (0.6.0)

Spec-platform has `Prediction[measures](1:N)Task`. This is a production-ready forecasting system.

**Ship:**
- `dotdog predictions` on every `dotdog validate` — show prediction status alongside completeness score
- Prediction trend tracking: if a prediction was marked `wrong`, log it in the .dag history
- Blog post: "Dogfooding dotdog: How our own spec predicts itself" (written)

**Why**: The predictions system is dotdog's moat. No other spec tool tracks forecasts against outcomes. The Task lifecycle (specified → building → built → verified → shipped) maps naturally to prediction resolution.

## Phase 2 — External adoption (0.7.0)

**Ship:**
- CLI onboarding: `dotdog init` guides through predictions setup
- kit templates include example predictions
- integration with GitHub milestones — resolve predictions when milestone closes

**Why**: An external team using dotdog proves it's not just our own dogfood.

---

dotdog@<span id="version">0.5.2</span>
