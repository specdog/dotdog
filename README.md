# spec

Central specification repository for the spec-driven development methodology.

## What this is

A **spec genome** — multiple files, each capturing one dimension of a software project. The app is treated as a person: it has a face (UI), a body (data model), a voice (copy), rules (constitution), and a plan. Together they form a complete model that a human can understand in 5 minutes and an AI agent can execute.

Based on the CryptChat specs/ directory — proven at ETHGlobal NYC 2026 (2 developers, 36 hours, shipped working product).

## Philosophy

> The spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.

Traditional specs answer "what should we build?" Spec genomes answer every question about the project — what it does, what it looks like, what it says, what can break, what we know, what we don't know, and who builds what.

An AI agent reading a spec genome can:
- Understand the full system without asking "but what about...?"
- Simulate scenarios and predict outcomes
- Assign work to the right subagent
- Build the feature with zero ambiguity

## Getting Started

Read [INDEX.md](INDEX.md) for reading paths, then [spec-template.md](spec-template.md) for the master template. Copy the templates you need into your project's `specs/` directory.

## Templates

| Template | Question it answers |
|----------|-------------------|
| `spec-template.md` | Which files to create and why |
| `SPEC-template.md` | What does the app do? |
| `constitution-template.md` | What are the immutable rules? |
| `data-model-template.md` | What are the exact types? |
| `plan-template.md` | What's the execution plan? |
| `COPY-template.md` | What does the user see? |
| `DESIGN-SYSTEM-template.md` | What are the tokens and components? |
| `tasks/AGENTS-template.md` | Which AI agent does what? |

## Reference Implementation

[CryptChat specs/](https://github.com/logohere/cryptchat/tree/main/specs) — 20+ spec files driving a real ETHGlobal hackathon project.

## Roadmap

See [plan-digital-twin.md](plan-digital-twin.md) — evolving these specs into a predictive digital twin with live data, simulation engine, and AI-native validation.
