# Contributing to dotdog

## Philosophy

The spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.

## Feed the dog

Every change starts with `spec validate`. If the score drops, fix it before committing.

## PRs

- Branch from main: `feat/`, `fix/`, `docs/`
- `spec validate` must pass
- PRs reviewed against the constitution
- Squash merge only

## Format

The `.dog` format spec lives at `projects/spec-platform/specs/format-spec.dog`. Changes to the format require a spec update first.
