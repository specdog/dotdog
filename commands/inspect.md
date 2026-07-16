---
description: "Compile and inspect imported Spec Kit graphs"
---

# Inspect imported Spec Kit graphs

## Prerequisites

1. Run this command from the root of the intended Spec Kit project.
2. Confirm `dotdog --version` is 0.9.0 or newer.
3. Confirm `.doghouse/speckit/` exists. Run `/speckit.dotdog.import` first when it does not.

## User Input

$ARGUMENTS

This command accepts no input. Do not interpolate `$ARGUMENTS` into a shell command. Stop when any argument is supplied.

## Steps

1. Verify `.doghouse/speckit/` is a real directory inside the current project root and is not a symlink.
2. Compile all imported feature projects:

   ```bash
   dotdog compile .doghouse/speckit
   ```

3. Run structural analysis:

   ```bash
   dotdog analyze .doghouse/speckit
   dotdog design .doghouse/speckit --json
   ```

4. Enumerate generated `.dag` files only beneath `.doghouse/speckit/`. For each regular, non-symlinked file, run:

   ```bash
   dotdog audit --require-kind entity --json "<verified-dag-file>"
   ```

5. Report failed audits, missing node kinds, model gaps, and the feature directory for each finding.

## Safety

- Never execute user input as shell text.
- Do not follow symlinks or inspect files outside `.doghouse/speckit/`.
- Do not invent domain requirements or modify source Spec Kit artifacts.
- Do not make network calls, expose listeners, use credentials, or elevate privileges.
