---
layout: default
title: "Observed Workspace Graphs"
description: "dotdog observe, ask, and drift turn a software workspace into deterministic graph facts."
---

← [Blog](index)

# Observed Workspace Graphs

Most software tools treat a repository as a pile of files. Humans and agents then rediscover the same facts over and over: which files exist, which routes are present, which specs mention a behavior, which tests cover a surface, and which generated artifacts are stale.

Dotdog's observed workspace graph is a deterministic snapshot of that reality.

```bash
dotdog observe
dotdog ask "which files define routes?"
dotdog drift
```

`dotdog observe` walks the current repo or workspace, maps implementation surfaces, and writes machine-readable artifacts under `.doghouse/`:

```text
.doghouse/observed.json
.doghouse/facts.jsonl
.doghouse/workspace.dag
```

The important unit is a cited graph fact. A fact has a subject, predicate, object, source, confidence, and optional repo/file location. That makes it small enough for tools to query and concrete enough for humans to inspect.

```json
{
  "subject": "src/routes/status.ts",
  "predicate": "is",
  "object": "api_route",
  "source": "code",
  "confidence": "compiled"
}
```

`dotdog ask` is intentionally deterministic. It does not need a model to answer basic workspace questions. It searches observed facts first and returns matching source paths.

`dotdog drift` checks whether observed facts are missing, stale, or pointing at files that no longer exist. It is a local safety check before heavier automation, CI gates, or agent workflows.

This gives Dotdog a simple public contract: map the workspace, write cited facts, query the facts, and report drift.

The goal is not to replace source code or specs. The goal is to stop every person and every agent from starting at zero.
