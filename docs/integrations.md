---
layout: default
title: "Integrations"
description: "AI coding agents and tools that work with dotdog."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)


# Integrations

dotdog serves specs to any MCP-compatible agent. Six tools: `getEntity`, `traverse`, `search`, `schema`, `summary`, `listProjects`.

## Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Restart Claude Code. Verify:

```
> List the projects available via dotdog
> What entities are defined in this project?
```

## Claude Desktop

Add to Claude's MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Restart Claude Desktop. dotdog appears in the tools menu.

## Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Restart Cursor. Agent queries specs via Cmd+I.

## GitHub Copilot

Add to `.github/copilot-instructions.md` or VS Code MCP config:

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

## Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "mcpServers": {
      "dotdog": {
        "command": "npx",
        "args": ["-y", "dotdog", "serve"]
      }
    }
  }
}
```

## MCP Gateway

Run dotdog behind an MCP gateway for multi-agent access:

```yaml
# mcp-gateway config
servers:
  dotdog:
    command: npx
    args: ["-y", "dotdog", "serve"]
    env:
      HOME: "/home/user"
```

## Homebrew

```bash
brew tap specdog/tap
brew install dotdog
```

## npm

```bash
npm install -g dotdog
```
