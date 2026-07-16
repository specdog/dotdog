---
description: "Serve imported Spec Kit graphs over local stdio MCP"
---

# Serve imported Spec Kit graphs

## Prerequisites

1. Confirm `dotdog --version` is 0.9.0 or newer.
2. Confirm `.doghouse/speckit/` exists. Run `/speckit.dotdog.import` first when it does not.

## User Input

$ARGUMENTS

Treat the input as an optional project-root path. Use the current directory when it is empty.

## Steps

1. Compile the imported graphs:

   ```bash
   dotdog compile "<project-root>/.doghouse/speckit"
   ```

2. Start the local MCP server in the foreground:

   ```bash
   dotdog serve "<project-root>/.doghouse/speckit"
   ```

3. Keep the process attached to stdio. Do not expose a network listener or add credentials.
4. When the session ends, stop the process normally and leave generated graph files unchanged.
