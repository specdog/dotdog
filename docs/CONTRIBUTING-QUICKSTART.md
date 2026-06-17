# Contributing to dotdog — Quick Start

For new contributors. Every step has a CLI command you can copy-paste.

## 1. Fork and clone

```
gh repo fork specdog/dotdog --clone
cd dotdog
```

## 2. Set up

```
bun install
bun test
dotdog validate
```

All tests must pass. Dogfood must be 100%.

## 3. Create an issue

```
gh issue create --repo specdog/dotdog --template bug.md --title "fix: describe the bug" --body "## What happened..."
```

Or use the web UI: https://github.com/specdog/dotdog/issues/new/choose

Label it. Assign yourself. Add it to a milestone if one exists.

## 4. Create a branch

```
git checkout -b fix/describe-the-fix
```

Branch naming: `fix/`, `feat/`, `docs/`, `chore/` prefix.

## 5. Write code and tests

Code lives in `packages/dotdog/src/`. Tests in `packages/dotdog/__tests__/`. Run after every change:

```
bun test
dotdog validate && dotdog compile
```

## 6. Commit

Conventional commits only:

```
git commit -m "fix: predictions parser now detects container format"
```

Allowed prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`

## 7. Push and create a PR

```
git push -u origin fix/describe-the-fix
gh pr create --repo specdog/dotdog --title "fix: short description" --body "Closes #123. What changed and why."
```

The PR template will auto-fill. Fill in: Summary, Changes, Verification checklist.

## 8. What happens next

CI runs `bun test` and the version check. A maintainer reviews. After merge your commit is in `main`.

## AI agent notes

If you're an AI agent contributing:
- Run `dotdog compile` to rebuild the .dag before opening a PR
- Search existing issues with `gh issue list --repo specdog/dotdog --limit 50`
- Read `CLAUDE.md` for project-specific agent instructions
- Commit messages must use conventional commit format
