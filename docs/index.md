# dotdog

The spec dog. Ship with specs.

## Install

```bash
npm install -g dotdog
```

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks.

```
$ dotdog init my-app
$ dotdog validate

  my-app — 5 .dog files, 100% complete

$ dotdog serve
  AI agents query your specs with zero hallucination
```

## Commands

| Command | What it does |
|---------|-------------|
| `dotdog validate` | Score your project completeness |
| `dotdog parse` | See every section and entity |
| `dotdog compile` | Build a .dag graph |
| `dotdog generate` | Fill missing spec files |
| `dotdog serve` | MCP server for AI agents |
| `dotdog staleness` | Find outdated specs |
| `dotdog visualize` | Draw a Mermaid graph |

## Format

- `.dog` — Human-written spec (markdown + YAML). Free forever.
- `.dag` — Machine-compiled graph (JSON). For AI agents.

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
