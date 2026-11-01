---
layout: default
title: Selected type contracts
---

# Selected type contracts

The unreleased 1.0.0 candidate can inspect one exported TypeScript contract and its bounded declared-type references. Specs retain intended behavior; compiler checks enforce encoded constraints; graphs retain relationships and evidence. None substitutes for behavioral tests or runtime input validation.

## Requirements

- Node.js 22.12.0 or newer and a built Dotdog checkout, or the package after 1.0 publication.
- TypeScript **7.0.2** installed in the consumer project/workspace. Dotdog does not install a compiler or require a beta version.
- A selected export/file contained in an explicit project configuration. JSONC, inherited options and compiler-resolved aliases are exercised by the integration tests.

The adapter is version-specific because it uses `typescript/unstable/sync`. Other versions fail explicitly rather than silently using a different compiler/configuration. Bun entry points use a bounded Node worker because this compiler's synchronous transport does not work under Bun. Run only a trusted project-installed compiler; version metadata does not authenticate its publisher.

## Inspect, import and query

This example uses Dotdog's existing public workspace types from a development checkout:

```sh
node packages/dotdog/dist/cli.js types inspect WorkspaceConfig --file packages/dotdog/src/workspace/types.ts --project packages/dotdog/tsconfig.json --json > type-contracts.json &&
node packages/dotdog/dist/cli.js graph import type-contracts.json --project types
node packages/dotdog/dist/cli.js impact 'packages/dotdog/src/workspace/types.ts#RepoConfig' --dag .doghouse/imported/types.dag --json
node packages/dotdog/dist/cli.js graph audit --dag .doghouse/imported/types.dag --profile evidence --json
```

Only import an inspection that exits successfully. In another project, select its own configuration, source file and export. A re-export resolves to the actual declaration; the returned `selectedId` is the exact root identity. IDs contain declaration positions and can change after edits. Labels are file-qualified, so repeated names are not silently joined.

The saved graph works with existing context, impact, path and MCP queries. No MCP query launches the compiler. Source/binary or authored-spec links are not inferred from matching names; keep requirement-to-type/test links explicit and reviewed.

## What results mean

- `ok: true` means the configured compiler checks passed and the selected contract was recovered. Coverage remains `partial`: this is not complete semantic closure or a runtime caller graph.
- Contracts retain full signatures, file/line identity, compiler version, configuration identity and the inspected-input digest. These remain on node evidence after generic graph import and MCP retrieval.
- `config.checking` lists explicitly configured checking options. Omitted options use that compiler version's defaults; absence is not reported as `false`.
- Input evidence records repository file digests and observation time. Existing evidence audits detect changes to recorded files; they cannot discover new/unloaded files or automatically recheck external libraries. Re-inspect after project, compiler or dependency changes.
- Diagnostic failures return a nonzero exit and diagnostic codes, not raw absolute-path compiler output. No failed compiler check becomes an empty successful type inspection.

The adapter handles tested selected signatures, overloads, unions, aliases/re-exports and repeated names. External or unresolved declarations and traversal/budget omissions stay explicit. Project-reference builds, composite projects and `noCheck` configurations are unsupported. A compiler pass is conditional on the original configuration; it does not verify whether the encoded rule is the right business rule.

## Boundaries

Inspection uses the original configured project without declaration emit, config edits or project build output. Inputs are cached during inspection and their digests checked afterward; this is not race-free multi-user filesystem isolation or continuous freshness monitoring.

Limits: 30 seconds; 512 read inputs/32 MiB combined input bytes; 64 contracts/64 KiB signature text; 10,000 visited declaration nodes/depth 128; 100 returned diagnostics; 1 MiB combined worker output. These are processing bounds, not a general peak-memory guarantee. Root extraction failures are non-passes; truncated dependency context is explicitly partial. Timeout/output-limit handling terminates the worker process tree.

Source signatures and literal types may contain sensitive project data. Review exported graphs before sharing. Graph text is data, not permission or instructions. The default evidence audit is artifact traceability; it does not introduce a simulator, cloud service, device operation or another graph backend.
