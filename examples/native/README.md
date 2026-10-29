# Real Ghidra → REA → Dotdog fixture

`callgraph.c` is a small MIT-licensed fixture under the repository license. Its known source relationship is `dotdog_validate` calling `dotdog_scale`. The integration check performs static analysis only; it never executes the binary.

## Reproduce on a configured macOS arm64 host

```sh
bun install --frozen-lockfile
bun run build
mkdir -p .doghouse/native-build
clang -O0 -g -o .doghouse/native-build/callgraph examples/native/callgraph.c
node scripts/check-native.mjs --solidstate /absolute/path/to/solidstate.mjs --binary .doghouse/native-build/callgraph --symbol _dotdog_validate --output .doghouse/native-check
```

Supply the actual installed SolidState CLI entry point. The checker uses only `solidstate reverse mcp`; it does not register REA directly, install providers or alter runtime configuration. The output directory must not already exist. The configured Ghidra/Java/provider must be usable before running the check.

The checker opens the binary, requests real Ghidra call relationships, saves the NativeCallGraph body, imports it through the built Dotdog CLI and asserts a one-hop path. It verifies the binary digest before/after analysis and closes the provider session. Full provider evidence is saved as `evidence.private.json` and can include local paths; keep it private. The call-graph body and separately reviewed verification metadata are suitable for an example, not the full unreviewed provider response.

## Recorded evidence

`verification.json` records the actual compiler, engine, source/binary/export digests and addresses from the 2026-10-29 macOS arm64 run. `callgraph-ghidra.json` is that run's reviewed NativeCallGraph body: two nodes and one resolved call. Dotdog imported both nodes and returned the expected one-hop relationship. Original executable bytes were unchanged.

An initial unprefixed procedure name was rejected by Ghidra; the Mach-O symbol is `_dotdog_validate`. Addresses and binary identity belong to the recorded build and may differ after recompilation. This example does not establish behavior equivalence, complete whole-program call recovery, indirect-call resolution or portability of Ghidra to every host.
