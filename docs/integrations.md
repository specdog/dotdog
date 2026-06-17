---
layout: default
title: "Integrations"
description: "AI coding agents and tools that work with dotdog."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents](https://specdog.github.io/agents)



## MCP Clients

Configure any MCP-compatible agent to query your specs:

### Claude Desktop

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

### Cursor

Add to `.cursor/mcp.json`:

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

### GitHub Copilot

See the [Copilot MCP documentation](https://docs.github.com/en/copilot) for setup.

## VS Code Extension

Syntax highlighting for `.dog` files. Copy from `extensions/vscode` into your VS Code extensions directory.

## Homebrew

```bash
brew tap specdog/dotdog
brew install dotdog
```

## npm

```bash
npm install -g dotdog
```
