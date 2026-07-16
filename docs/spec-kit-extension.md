---
layout: default
title: Dotdog Spec Kit Extension
---

# Dotdog Spec Kit Extension

Dotdog imports GitHub Spec Kit feature artifacts into local, queryable knowledge graphs without modifying the source artifacts.

## Requirements

- GitHub Spec Kit 0.12.0 or newer
- Dotdog 0.9.0 or newer
- A Spec Kit project containing `.specify/` and `specs/`

Install Dotdog:

```bash
npm install -g dotdog@0.9.0
```

Install the extension from a tagged release:

```bash
specify extension add dotdog --from https://github.com/specdog/dotdog/archive/refs/tags/v0.9.0.zip
```

## Commands

- `/speckit.dotdog.import` imports feature artifacts into `.doghouse/speckit/` and compiles them.
- `/speckit.dotdog.inspect` audits imported graphs and reports model gaps.
- `/speckit.dotdog.serve` starts Dotdog's local stdio MCP server for the imported graphs.

## Safety

The importer is local-only. It does not make network requests, upload source content, or modify `.specify/` and `specs/`. Generated files are hash-tracked, edited outputs are preserved by default, Markdown source is quoted, and symlinked or protected paths are rejected.
