# Contributing to dotdog

New here? Jump to the [Quick Start](docs/CONTRIBUTING-QUICKSTART.md) — every step has copy-pasteable CLI commands.

Thanks for contributing.

## Philosophy

The spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.

## Getting Started

```bash
git clone https://github.com/specdog/dotdog.git
cd dotdog
bun install
bun test
```

## Development

- Runtime: Bun >= 1.3
- Language: TypeScript
- Tests: `bun test`
- Build: `bun run build`
- Dogfood: `bun packages/dotdog/src/cli.ts validate && bun packages/dotdog/src/cli.ts compile`

## Pull Requests

1. Branch from `main`
2. Write tests for new behavior
3. Run `bun test` — all tests must pass
4. Run `bun packages/dotdog/src/cli.ts validate` — dogfood must pass
5. Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`
6. Open a PR with a clear description

## Issues

- Search existing issues before opening a new one
- Use the issue templates for bugs and feature requests
- Include reproduction steps for bugs
- Include use cases for feature requests

## Code Style

- TypeScript strict mode
- Keep the single-file CLI architecture
- Backward-compatible changes to .dag format
- Test both v2 positional and v1.5 formats

## Project Structure

```
packages/dotdog/          Published npm package
  src/cli.ts               All CLI commands (single file)
  src/serve.ts             MCP server
  src/parser.ts            .dog file parser
  src/grammar.ts           TypeScript types
  __tests__/               Test suite
projects/spec-platform/    Dogfood spec (the tool validates itself)
docs/                      Website (GitHub Pages)
templates/                 Spec genome templates
```


## Versioning

dotdog follows **MAJOR.MINOR.PATCH** (semver).

| Change | Bump | Example |
|--------|------|---------|
| Bug fix | PATCH | 0.5.0 → 0.5.1 |
| New feature | MINOR | 0.5.1 → 0.6.0 |
| Breaking change | MAJOR | 0.6.0 → 1.0.0 |

**Every code change gets a version bump.** No accumulating changes across releases.

### Docs

Documentation-only changes follow their own cycle — no version bump required for website, README, or guide updates. Docs versioning is tracked separately via git history.

### Release checklist

1. Update version in `packages/dotdog/package.json`
2. Update `CHANGELOG.md` with the new version entry
3. Tag: `git tag vX.Y.Z`
4. Push tag: `git push --tags`
5. CI publishes to npm on `v*` tags

## Questions

Open a discussion or issue. Happy to help.
