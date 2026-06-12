# Security Policy

## Supported Versions

| Version | Supported |
|---------|----------|
| 0.3.x   | Yes |
| 0.2.x   | No |
| 0.1.x   | No |

## Reporting a Vulnerability

Do not open a public issue. Email security@specdog.dev.

We respond within 48 hours. We'll coordinate disclosure and a patch release.

## Supply Chain

- Published via GitHub Actions with OIDC Trusted Publishing (no personal tokens)
- All dependencies pinned and audited (2 direct deps: chalk, commander)
- No postinstall scripts — zero code execution on `npm install`
- `files` field in package.json limits published surface to dist/ + docs only
- Two-person review required on all PRs (branch protection)

## Prompt Injection Resistance

The MCP server (`dotdog serve`) serves typed JSON, not raw markdown. This limits injection surface:

- All responses are `JSON.stringify()` of typed objects — no raw prose leakage
- The `schema` tool returns property names and types only — zero prose
- The `.dag` compiled format strips 88%+ of prose before agent consumption
- Entity descriptions are the only prose field — user-controlled, not executable

## Integrity

Every `.dag` file includes a SHA256 hash of its source `.dog` files. Agents can verify the graph matches the spec before trusting its contents.

## If you suspect a compromised release

Check the commit SHA against the tag in this repo. Verify the `.dag` integrity hash matches source files.
