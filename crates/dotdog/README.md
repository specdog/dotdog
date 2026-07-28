# dotdog (Rust)

Rust implementation of the Dotdog CLI for structured software specifications and compiled project graphs.

```bash
dotdog guide greenfield
dotdog guide existing
dotdog guide speckit
```

Core loop:

```bash
dotdog validate
dotdog compile
dotdog visualize path/to/project.dag --format html --save
dotdog serve
```

The HTML map is self-contained and supports node search, connection focus, pan, and zoom. `dotdog serve` exposes the compiled graph to MCP-compatible coding agents over stdio.

This prerelease Rust crate is intended for compatibility testing. The npm package remains the stable distribution until the parity matrix and release checklist in `docs/RUST-PORT-PLAN.md` are complete.
