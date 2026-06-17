---
layout: default
title: "Dogfooding dotdog: How our own spec predicts itself"
date: 2026-06-17
author: Justin Diclemente
description: "dotdog validates itself. We predicted 90%+ token savings — hit 93.9%. We predicted 200 PRs by July. Here's how the predictions system works."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)

dotdog validates itself. The `spec-platform` dogfood project runs `dotdog validate`, `dotdog compile`, and `dotdog simulate` on every change. But we also use it to make predictions about the project — and then track whether those predictions came true.

## The predictions system

Every dotdog project can define predictions in its data model. A prediction is a forecast about the project itself:

```yaml
prediction: spec-platform .dag savings exceed 90%
trigger: spec-platform SPEC.dog grows past 15KB
timeframe: 2026-08-01
confidence: 0.9
measurement: dotdog tokens command on spec-platform
status: correct
```

These live in `data-model.dog` alongside entities and relationships. The `.dag` graph includes them. `dotdog predictions` lists them. `dotdog resolve --correct` marks them as verified or wrong.

## What we predicted, and what happened

Here's the current prediction log for dotdog 0.5.1:

| Prediction | Confidence | Status | Verdict |
|-----------|-----------|--------|---------|
| .dag token savings will exceed 90% for spec-platform | 90% | correct | **93.9% actual** |
| First external user will adopt dotdog | 50% | correct | Community contributors merged |
| dotdog will reach 200 PRs by July 2026 | 80% | pending | Tracking at current velocity |

The token savings prediction was our first real test. We set a 90% threshold, tagged it `correct` when the v2 positional format landed, and the measurement confirmed 93.9%. That's not a demo — that's the tool checking itself.

## Why this matters

Most projects ship and forget. Nobody goes back to check whether the estimates were right. The predictions system makes forecasting a first-class part of the spec:

1. **Write the prediction** in the data model, with a trigger, timeframe, confidence, and measurement
2. **Ship the code** that the prediction is about
3. **Run `dotdog resolve`** to mark it correct, wrong, or partial
4. **Learn** — over time, the project accumulates a track record of prediction accuracy

For AI agents, this means the `.dag` graph contains not just what the project IS, but what it EXPECTS. An agent can query predictions, check confidence scores, and prioritize work based on what's overdue or under-confident.

## The dogfood loop

Every time we add a feature to dotdog, we add a prediction to our own spec:

1. Write the prediction in `data-model.dog`
2. Ship the feature
3. Resolve the prediction against real data
4. The prediction either validates the feature or exposes a gap

The simulation command runs 6/6 steps against spec-platform entities — Node, Task, Prediction, Compile, DAG — and verifies every step references known entities. No fantasy entities. No payment flows. Just the dotdog spec validating dotdog.

## Try it

```
npm install -g dotdog@0.5.1
git clone https://github.com/specdog/dotdog.git
cd dotdog
dotdog predictions
dotdog resolve --correct "dag savings exceed 90"
```

---

dotdog@<span id="version">0.5.1</span> · [GitHub](https://github.com/specdog/dotdog) · [npm](https://www.npmjs.com/package/dotdog)
