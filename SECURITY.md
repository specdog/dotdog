# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in dotdog, please report it privately. Do not open a public issue.

Use [GitHub private vulnerability reporting](https://github.com/specdog/dotdog/security/advisories/new). Include the affected version, reproduction steps, impact and a minimal sanitized example. Do not include credentials or unrelated personal data.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes |
| 0.9.x   | Yes |
| 0.8.x   | Yes |
| < 0.8.0 | No |

## Scope

- MCP server input validation
- Path traversal in file operations
- YAML injection in .dog files
- Local path and credential exposure
- External provider and child-process isolation
- Token savings calculation integrity

The bundled `dotdog serve` MCP server uses stdio and does not open a network listener. Generated `.doghouse` graph artifacts are ignored by default because they may contain repository metadata.

Workspace responses use repository-relative paths. The legacy `cwd` field remains as a relative compatibility alias for `path` and must not be treated as an absolute process working directory.

## 1.0 hardening

Dotdog 1.0 adds static symlink/output-boundary checks, validated hook ownership, bounded MCP lines and graph inputs, and explicit read-only provider calls. Graph descriptions, source and imported evidence remain untrusted data, not agent instructions or execution authority.

`live` intentionally contacts declared HTTP(S) destinations, including local endpoints. Review untrusted specs before running it. Cloud provider credentials remain in the user's configured environment/CLI; fixed-origin HTTP requests reject redirects. Redaction and credential-file exclusions are best-effort, not a guarantee that exports contain no private data.

Dependency-change and scheduled CI run `bun audit --json`; builds use the frozen lockfile. Patched transitive overrides are documented in the [security audit](docs/v1-security-audit.md). Advisory checks do not detect every vulnerability or malicious package.

The optional embodied evidence profile is advisory traceability only; it neither certifies physical safety nor grants device authority. No live hardware or ROS integration is claimed. The saved-export Ghidra/REA workflow has been checked with the [public static-analysis fixture](examples/native/README.md); it does not establish complete call recovery, runtime equivalence or support for every target/host.
