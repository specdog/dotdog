# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in dotdog, please report it privately. Do not open a public issue.

Email: security@specdog.dev (or open a private security advisory on GitHub)

We will respond within 48 hours and work on a fix.

## Supported Versions

| Version | Supported |
|---------|-----------|
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
