# dotdog — Product Plan

> Derived from the ground truth: 22 entities across 3 projects, 2 undefined references, 1 dangling edge.

## State

3 projects dogfooding dotdog:

| Project | Entities | Domain |
|---------|----------|--------|
| spec-platform | 5 | CLI spec tool |
| magic-cabinet | 8 | 3D interior planning |
| intelligence-amplifier | 7 | AI agent architecture |

All 3 validate at 95%+. All 3 compile to .dag. All 3 simulate successfully.

## Phase 1 — Ground the undefined (0.6.0)

The Compile node references SOUL and AuditTrapdoor. Neither is a defined entity. The DAG cannot include nodes for undefined entities.

**Add to data-model.dog:**
- `SOUL` entity — the behavioral constitution that gates AI agent actions
- `AuditTrapdoor` entity — the self-check that fires every N tool calls

**Why**: Compile[produces](1:1)DAG is the spine. Every entity that Compile references MUST produce a node in the DAG. Undefined references are invisible to `dotdog simulate` and MCP queries.

## Phase 2 — Predictive milestones (0.6.0)

Spec-platform has `Prediction[measures](1:N)Task`. This is a production-ready forecasting system.

**Ship:**
- `dotdog predictions` on every `dotdog validate` — show prediction status alongside completeness score
- Prediction trend tracking: if a prediction was marked `wrong`, log it in the .dag history
- Blog post: "Dogfooding dotdog: How our own spec predicts itself" (written)

**Why**: The predictions system is dotdog's moat. No other spec tool tracks forecasts against outcomes. The Task lifecycle (specified → building → built → verified → shipped) maps naturally to prediction resolution.

## Phase 3 — External adoption (0.7.0)

3 projects prove it works. Next: one external team.

**Ship:**
- CLI onboarding: `dotdog init` guides through predictions setup
- kit templates include example predictions
- integration with GitHub milestones — resolve predictions when milestone closes

**Why**: magic-cabinet proves the format works outside CLI tools. intelligence-amplifier proves it works for AI architecture. An external team proves it's not just our own dogfood.

## Phase 4 — Cross-graph federation (0.8.0)

intelligence-amplifier's ResearchPipeline discovers Techniques. spec-platform's Compile produces DAGs. The two should connect.

**Ship:**
- `dotdog federate` — merge multiple .dag graphs into a supergraph
- Cross-project entity resolution: if project A references `SOUL` and project B defines it, link them
- MCP federation: query across projects

**Why**: The intelligence-amplifier DAG references `ExternalConfidenceVerification` and `ConfidenceMarker` that don't exist. Cross-graph federation would surface these dangling references and let the agent resolve them.

---

dotdog@<span id="version">0.5.1</span>
