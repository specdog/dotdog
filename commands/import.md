---
description: "Import Spec Kit artifacts into local Dotdog knowledge graphs"
---

# Import Spec Kit artifacts

## Prerequisites

1. Run in a GitHub Spec Kit project containing `.specify/` and `specs/`.
2. Confirm `dotdog --version` is 0.9.0 or newer.

## User Input

$ARGUMENTS

Treat the input as an optional project-root path. Use the current directory when it is empty.

## Steps

1. Resolve the project root and verify that `.specify/` and `specs/` exist inside it.
2. Run:

   ```bash
   dotdog speckit import "<project-root>" --json
   ```

3. Do not add `--force` unless the user explicitly requests replacement of edited generated files.
4. Compile the imported projects:

   ```bash
   dotdog compile "<project-root>/.doghouse/speckit"
   ```

5. Report the imported feature IDs, written/unchanged/skipped counts, and compile result.

## Safety

- Do not modify `.specify/` or `specs/`.
- Keep all generated output under `.doghouse/speckit/`.
- Stop and report the error if Dotdog rejects a symlink, protected path, or out-of-root path.
