# Contributing to dotdog

## Philosophy

The spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.

## Feed the dog

Every change starts with `dotdog validate`. If the score drops, fix it before committing.

## PRs

- Branch from main: `feat/`, `fix/`, `docs/`, `chore/`
- Run `dotdog validate` and `dotdog analyze` before opening
- Score must not decrease
- PRs reviewed against the constitution
- Squash merge only
- Conventional commits required (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)

## Format

The `.dog` format spec lives at `spec/format-spec.dog`. The `.dag` format spec lives at `spec/format-spec-dag.dog`. Changes to either format require a spec update in those files first.
