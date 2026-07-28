# Dotdog Rust Port Plan

Status: feature-complete prerelease candidate on `feat/rust-port`; no public Rust release published

## 1. Objective

Port the published `dotdog` TypeScript/Bun CLI to Rust without changing the `.dog` language, compiled `.dag` formats, command names, machine-readable output, exit-code behavior, or MCP tool contracts.

The TypeScript implementation remains the behavioral reference until the Rust implementation passes parity checks. No branch push, pull request, tag, crates.io upload, or public release is part of this work without separate approval.

## 2. Current baseline

- Source: approximately 7,075 TypeScript lines across 33 files.
- Tests: 58 passing Bun tests and one snapshot.
- CLI: approximately 40 command and subcommand declarations.
- Published package: npm `dotdog` 0.9.0.
- External behavior includes filesystem operations, JSON/YAML parsing, graph compilation and querying, stdio MCP, HTTP calls, child processes, and cloud-provider checks.
- Rust crate: `dotdog` 0.9.0-alpha.1 with `dotdog` and `spec` binaries.
- Rust command surface: all TypeScript command groups are routed, plus `guide` and offline interactive HTML visualization.
- Rust tests: 20 passing unit, CLI, MCP transcript, workspace, mapping, live-contract, parser, and Spec Kit tests.
- TypeScript reference tests: 58 passing tests and one snapshot.

Baseline command:

```sh
bun test packages/dotdog/__tests__
```

Expected baseline: 58 passed, 0 failed.

Verified on this branch:

```text
cargo fmt --all -- --check                                      pass
cargo clippy --workspace --all-targets --all-features -- -D warnings pass
cargo test --workspace --all-features                           20 pass
cargo package --manifest-path crates/dotdog/Cargo.toml          pass
cargo publish --dry-run --manifest-path crates/dotdog/Cargo.toml pass; upload aborted as required
bun test packages/dotdog/__tests__                               58 pass
```

## 3. Constraints and invariants

1. Preserve `.dog` parser semantics and line information.
2. Preserve v1.5 read compatibility and v2/v3 `.dag` write/read compatibility.
3. Preserve stable JSON field names, positional arrays, ordering, and exit codes.
4. Do not read or mutate specification source as part of runtime graph queries; compiled DAGs remain the agent-facing representation.
5. Do not alter the existing npm package during the compatibility period.
6. Do not publish incomplete parity under the stable `dotdog` crate version.
7. Tests must exercise observable behavior, not only internal functions.
8. Path traversal, symlink, secret-file, and environment-redaction protections must be carried over before workspace and import commands are declared compatible.

## 4. Research decisions

### CLI

Use `clap` derive APIs. The current crate supports typed nested subcommands and generated help while allowing custom handling where exact compatibility requires it.

### Data formats

Use `serde` and `serde_json` for AST and DAG structures. Use `serde_yaml_ng` only where full YAML behavior is required; retain a compatibility parser for the existing intentionally limited YAML subset where exact legacy behavior matters.

### Graph operations

Keep the serialized DAG model independent of graph-library types. Use direct indexed adjacency for compatibility-sensitive operations and `petgraph` only for algorithms where it reduces risk without changing output ordering.

### Runtime and networking

Use `tokio` for async boundaries. Use `reqwest` for provider HTTP calls. Use the official `rmcp` SDK for the eventual protocol-complete MCP server, but first preserve the existing newline-delimited stdio JSON-RPC contract with golden tests.

### Packaging

Use a Cargo workspace with one publishable package initially. Cargo packaging must pass `cargo package` and `cargo publish --dry-run`; actual upload is explicitly excluded. The manifest includes crates.io metadata and limits packaged files.

Research references:

- Cargo manifest and workspaces: https://doc.rust-lang.org/cargo/reference/manifest.html and https://doc.rust-lang.org/cargo/reference/workspaces.html
- Cargo packaging and publishing: https://doc.rust-lang.org/cargo/commands/cargo-package.html and https://doc.rust-lang.org/cargo/commands/cargo-publish.html
- clap derive: https://docs.rs/clap/latest/clap/_derive/
- serde YAML NG: https://docs.rs/serde_yaml_ng/latest/serde_yaml_ng/
- petgraph: https://docs.rs/petgraph/latest/petgraph/
- axum: https://docs.rs/axum/latest/axum/
- Official MCP Rust SDK: https://github.com/modelcontextprotocol/rust-sdk

## 5. Target repository layout

```text
Cargo.toml
crates/
  dotdog/
    Cargo.toml
    README.md
    src/
      lib.rs
      main.rs
      cli.rs
      grammar.rs
      parser.rs
      project.rs
      dag.rs
      graph.rs
      design.rs
      workspace.rs
      mcp.rs
      providers/
    tests/
      cli.rs
      parser.rs
      dag.rs
      compatibility.rs
```

The package exposes a library for parser/compiler reuse and installs `dotdog` and `spec` binaries that call the same CLI entry point.

## 6. Delivery phases

Implementation status:

| Phase | Status |
|---|---|
| 0. Contract capture | Complete for the published 0.9.0 command surface; expand golden fixtures before stable cutover. |
| 1. Parser foundation | Complete. |
| 2. Core CLI and discovery | Complete. |
| 3. DAG and graph commands | Complete, including Mermaid and interactive HTML maps. |
| 4. Workspace, mapping, observation, and Spec Kit | Complete with portable-path and managed-output security tests. |
| 5. MCP, endpoints, and providers | Complete for stdio MCP and AWS, Cloudflare, Netlify, Railway, Supabase, and Vercel checks. Live credential acceptance still requires provider accounts. |
| 6. Distribution | CI and Cargo verification complete. Cross-platform release artifacts and public publication require explicit approval. |

### Phase 0 — Baseline and contract capture

- Record current tests, command tree, version output, and representative JSON/DAG fixtures.
- Add compatibility fixtures generated by TypeScript, not handwritten approximations.
- Define stable versus human-facing output fields.

Exit criteria: all baseline tests pass and fixtures are checked into the local branch.

### Phase 1 — Rust foundation and core parser

- Add Cargo workspace and publishable package metadata.
- Port grammar/AST types.
- Port parser, tables, compact blocks, lifecycle handling, and limited YAML behavior.
- Add parser golden tests against TypeScript JSON output.

Exit criteria: Rust parser matches selected legacy fixtures byte-for-byte after canonical JSON formatting.

### Phase 2 — Core CLI and project discovery

- Port `--version`, `init`, `list`, `validate`, `parse`, and `woof`.
- Preserve `projects/` and `specs/` discovery order and exit behavior.
- Add command integration tests using temporary directories.

Exit criteria: Rust integration tests cover each command and match TypeScript behavior.

### Phase 3 — DAG compiler and local graph commands

- Port v2/v3 DAG compilation, token metadata, audit, visualize, tokens, query, trace, path, index, search, predictions, and design audit.
- Preserve positional node schemas and deterministic output ordering.
- Cross-run both binaries on the same fixtures and compare outputs.

Exit criteria: compiled DAG and machine-readable command outputs are parity-tested.

### Phase 4 — Workspace, repository mapping, and imports

- Port safe path resolution, manifest validation, registry selection, redaction, repository mapping, observation, drift, Spec Kit import, kit handling, and atomic managed-file writes.
- Reproduce symlink and path-escape security tests before enabling commands.

Exit criteria: workspace and Spec Kit compatibility suites pass, including negative security cases.

### Phase 5 — MCP and external providers

- Port stdio JSON-RPC behavior and all existing tools.
- Move protocol handling to the official Rust MCP SDK after compatibility tests cover initialization and tool calls.
- Port HTTP and CLI-backed cloud-provider checks with explicit timeouts and secret-safe diagnostics.

Exit criteria: protocol transcripts and provider-boundary tests pass without exposing credentials.

### Phase 6 — Distribution and cutover

- Add Rust CI for format, lint, tests, package verification, and supported platforms.
- Build release binaries for Linux, macOS, and Windows.
- Run `cargo package` and `cargo publish --dry-run` locally/CI.
- Document coexistence, migration, rollback, and npm deprecation policy.
- Publish only after explicit approval and a crate-name ownership check immediately before release.

Exit criteria: clean package build from the generated `.crate`, full parity matrix green, and approved release checklist.

## 7. Verification matrix

Required before declaring full parity:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
cargo package --manifest-path crates/dotdog/Cargo.toml
cargo publish --dry-run --manifest-path crates/dotdog/Cargo.toml
bun test packages/dotdog/__tests__
```

Compatibility checks compare:

- exit status;
- stdout and stderr where stable;
- canonical AST JSON;
- `.dag` JSON and positional arrays;
- generated filenames and directory layout;
- MCP JSON-RPC transcripts;
- path/symlink rejection behavior.

## 8. Principal risks

- The 2,292-line TypeScript CLI mixes orchestration and domain logic; direct translation would preserve hidden coupling. Rust modules must be split while outputs remain fixed.
- The legacy YAML parser intentionally differs from general YAML. Replacing it blindly would change accepted input and inferred scalar types.
- Filesystem ordering differs across platforms. All compatibility-sensitive enumeration must sort explicitly.
- MCP SDK adoption can change envelopes or protocol-version negotiation. Transcript tests must precede the SDK swap.
- crates.io package names are first-come, immutable by version, and published versions cannot be replaced. Final naming and ownership must be rechecked immediately before release.

## 9. Stable cutover gates

The implementation is feature-complete as a prerelease candidate. Before replacing the npm implementation as the stable distribution:

1. Run provider checks with dedicated least-privilege test accounts.
2. Expand byte-for-byte cross-language golden fixtures for every machine-readable command.
3. Build and smoke-test signed Linux, macOS, and Windows release artifacts.
4. Confirm crate ownership and the final crate name immediately before publication.
5. Obtain explicit approval for publication, npm migration messaging, and rollback policy.
