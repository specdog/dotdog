# Contributing to dotdog

New here? Jump to the [Quick Start](docs/CONTRIBUTING-QUICKSTART.md) — every step has copy-pasteable CLI commands.

## Philosophy

The spec is the source of truth. Code implements the spec. If code and spec disagree, fix the code. If spec is wrong, update spec first, then code.

## Getting Started

```bash
git clone https://github.com/specdog/dotdog.git
cd dotdog
bun install --frozen-lockfile
bun run lint
bun test
```

## Development

- Development runtime: Bun 1.3.14, matching CI
- Package runtime: Node.js >= 22.12.0; see README for Bun execution
- Language: TypeScript
- Tests: `bun test`
- Build: `bun run build`
- Dogfood: `bun packages/dotdog/src/cli.ts validate` and `bun packages/dotdog/src/cli.ts doctor`

## Pull Requests

1. Branch from `main`
2. Add regression coverage for meaningful behavior changes
3. Run `bun run lint` and the relevant tests, then `bun test` for code changes
4. Run `bun packages/dotdog/src/cli.ts validate` — dogfood must pass
5. Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`
6. Describe the change, compatibility impact, checks run and any remaining limitations

Keep personal information, credentials, machine-specific notes, raw conversation logs and private test evidence out of commits, issues and PRs. Use repository-relative examples and sanitized reproduction data. Check commit authorship before pushing; use a GitHub no-reply address when a personal email should remain private.

## Issues

- Search existing issues before opening a new one
- Use the issue templates for bugs and feature requests
- Include reproduction steps for bugs
- Include use cases for feature requests

## Code Style

- Follow the checked-in TypeScript configuration; `bun run lint` checks it
- Reuse existing modules and preserve public CLI/MCP contracts; avoid unrelated refactors
- Backward-compatible changes to .dag format
- Preserve supported legacy graph formats and test changed normalization/query behavior

## Project Structure

```
packages/dotdog/          Published npm package
  src/cli.ts               CLI entry point and command registration
  src/graph/               Normalization, traversal, context and import
  src/workspace/           Workspace parsing and repository boundaries
  src/serve.ts             MCP server
  src/parser.ts            .dog file parser
  src/grammar.ts           TypeScript types
  __tests__/               Test suite
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

1. Complete the [release acceptance gates](docs/v1-release-plan.md), migration notes and final review.
2. Align package, extension, lockfile, changelog and documentation versions.
3. Run the full checks and verify the packed artifact in an isolated consumer.
4. Obtain release approval before merging or creating a release tag.
5. Tag only the approved commit already on `main`; push that specific tag, not all local tags.
6. The tag workflow verifies the candidate and publishes only its checked tarball with provenance.

## Questions

Open a discussion or issue with the relevant version and a reproducible example. Report vulnerabilities through [the security policy](SECURITY.md), not a public issue.
