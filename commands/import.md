---
description: "Import Spec Kit artifacts into local Dotdog knowledge graphs"
---

# Import Spec Kit artifacts

## Prerequisites

1. Run this command from the root of a GitHub Spec Kit project containing `.specify/` and `specs/`.
2. Confirm `dotdog --version` is 0.9.0 or newer.

## User Input

$ARGUMENTS

This command accepts either no input or the exact word `force`. Do not interpolate `$ARGUMENTS` into a shell command. Reject paths, flags, command substitutions, separators, redirects, and any other input. Work only in the current project root.

## Steps

1. Verify that the current directory contains real, non-symlinked `.specify/` and `specs/` directories. Stop on any mismatch.
2. Run the local-only import:

   ```bash
   dotdog speckit import . --json
   ```

3. Add `--force` only when `$ARGUMENTS` is exactly `force` and the user explicitly requested replacement of edited generated files:

   ```bash
   dotdog speckit import . --json --force
   ```

4. Compile the imported projects:

   ```bash
   dotdog compile .doghouse/speckit
   ```

5. Report the imported feature IDs, written/unchanged/skipped counts, and compile result.

## Safety

- Never execute user input as shell text.
- Do not modify `.specify/` or `specs/`.
- Keep generated output under `.doghouse/speckit/`.
- Do not add network calls, credentials, telemetry, background processes, or elevated privileges.
- Stop and report the error if Dotdog rejects a symlink, protected path, edited output, or out-of-root path.
