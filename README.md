# dotdog

[![npm](https://img.shields.io/npm/v/dotdog)](https://www.npmjs.com/package/dotdog) [![License: MIT](https://img.shields.io/npm/l/dotdog)](https://github.com/specdog/dotdog/blob/main/LICENSE) [![CI](https://github.com/specdog/dotdog/actions/workflows/test.yml/badge.svg)](https://github.com/specdog/dotdog/actions)

Feed the dog. Ship with specs.

## The Flywheel

```
spec → validate → app → data → better spec → better app → ...
```

The spec describes the platform. The platform validates the spec. The validation report improves the spec. Each cycle adds granularity.

## Install

```bash
npm install -g dotdog
```

## Quick Start

```bash
npm install -g dotdog
dotdog init my-project
dotdog validate
```

## Commands

| Command | What it does |
|---------|-------------|
| `dotdog validate` | Score your spec completeness |
| `dotdog parse` | Parse .dog files to AST |
| `dotdog compile` | Compile .dog to .dag graph |
| `dotdog generate` | Generate missing spec files |
| `dotdog serve` | MCP server for AI agents |
| `dotdog staleness` | Detect drift between spec and reality |
| `dotdog visualize` | Draw a Mermaid graph from .dag |
| `dotdog init` | Scaffold a new project |
| `dotdog list` | List all projects |

## Format

- `.dog` — Human-written spec genome (markdown + YAML). Free and open source.
- `.dag` — Machine-compiled graph (JSON). Compiled by `dotdog compile`.

## Repository

```
dotdog/
├── packages/dotdog/     # CLI source
├── spec/                # Format specifications (.dog, .dag)
├── projects/            # Dogfood project (spec-platform)
├── templates/           # Project templates
├── extensions/vscode/   # VS Code extension
└── docs/                # GitHub Pages
```

## Score

```
spec validate → 100% complete

  ✓ SPEC.dog
  ✓ constitution.dog
  ✓ data-model.dog
  ✓ COPY.dog
  ✓ DESIGN-SYSTEM.dog
  ✓ plan.dog
  ✓ INDEX.dog
```
