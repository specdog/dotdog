---
description: "Serve imported Spec Kit graphs over local stdio MCP"
---

# Serve imported Spec Kit graphs

## Prerequisites

1. Run this command from the root of the intended Spec Kit project.
2. Confirm `dotdog --version` is 0.9.0 or newer.
3. Confirm `.doghouse/speckit/` exists. Run `/speckit.dotdog.import` first when it does not.

## User Input

$ARGUMENTS

This command accepts no input. Do not interpolate `$ARGUMENTS` into a shell command. Stop when any argument is supplied.

## Steps

1. Verify `.doghouse/speckit/` is a real directory inside the current project root and is not a symlink.
2. Compile the imported graphs:

   ```bash
   dotdog compile .doghouse/speckit
   ```

3. Start the local MCP server in the foreground:

   ```bash
   dotdog serve .doghouse/speckit
   ```

4. Keep the process attached exclusively to stdio. When the session ends, stop it normally and leave generated graph files unchanged.

## Safety

- Never execute user input as shell text.
- Do not expose a TCP, HTTP, WebSocket, or other network listener.
- Do not add credentials, environment secrets, telemetry, background persistence, or elevated privileges.
- Do not follow symlinks or read outside `.doghouse/speckit/`.
