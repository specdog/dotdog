---
layout: default
title: "dotdog now has badges and Homebrew"
date: 2026-06-17
author: Justin Diclemente
description: "dotdog v0.8.0 ships with a savings badge command, Homebrew install, and community contributions."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents · dogfood](https://specdog.github.io/agents)


# dotdog now has badges and Homebrew

Two small features that make dotdog feel like a real tool.

## Badge

Every project wants a badge. Coverage, build status, version. dotdog gives you a savings badge:

```
$ dotdog badge
  ✓ dotdog-badge.svg  (dotdog: 8.0K tokens saved)
```

The badge shows how many tokens you saved by compiling `.dog` files into a `.dag` graph. It's a shields.io-style SVG — same convention as npm, GitHub Actions, and codecov badges. Add it to your README:

```markdown
[![spec savings](dotdog-badge.svg)](https://github.com/specdog/dotdog)
```

The number counts up as your spec grows. More entities, more relationships, more tokens saved.

90%+ savings → green. 70-90% → yellow. <70% → red.

## Homebrew

```bash
brew tap specdog/tap
brew install dotdog
```

No more `npm install -g`. macOS users get dotdog through Homebrew. One tap, one install. `dotdog --version` works immediately.

## Community contributions

Two features in v0.8.0 came from the community:

- `dotdog list --json` — machine-parseable project listing
- `dotdog init` test coverage — verified on every commit

Both were tagged `good first issue` on GitHub. Both were implemented and merged. The pipeline works.

## Try it

```bash
dotdog badge          # generate a savings badge
dotdog list --json    # machine-parseable output
brew install dotdog   # or npm install -g dotdog
```

---

*[dotdog](https://github.com/specdog/dotdog) — v0.8.0 on npm and Homebrew. `npm install -g dotdog` or `brew install dotdog`.*
