# Contributing to dotdog

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

## Questions

Open a discussion or issue. Happy to help.
