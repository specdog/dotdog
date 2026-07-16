---
description: "Compile and inspect imported Spec Kit graphs"
---

# Inspect imported Spec Kit graphs

## Prerequisites

1. Confirm `dotdog --version` is 0.9.0 or newer.
2. Confirm `.doghouse/speckit/` exists. Run `/speckit.dotdog.import` first when it does not.

## User Input

$ARGUMENTS

Treat the input as an optional project-root path. Use the current directory when it is empty.

## Steps

1. Compile all imported feature projects:

   ```bash
   dotdog compile "<project-root>/.doghouse/speckit"
   ```

2. Run structural analysis:

   ```bash
   dotdog analyze "<project-root>/.doghouse/speckit"
   dotdog design "<project-root>/.doghouse/speckit" --json
   ```

3. Find each generated `.dag` file under `.doghouse/speckit/` and run this command separately with the file path quoted:

   ```bash
   dotdog audit --require-kind entity --json "<dag-file>"
   ```

4. Report failed audits, missing node kinds, model gaps, and the exact feature directory for each finding.
5. Do not invent domain requirements or modify source Spec Kit artifacts.
