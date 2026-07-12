---
layout: default
title: "Integrations"
description: "AI coding agents and tools that work with dotdog."
---



# Integrations

dotdog serves specs to any MCP-compatible agent. Nine tools: `getEntity`, `traverse`, `search`, `path`, `schema`, `summary`, `listProjects`, `workspace.list`, and `infraVerify`.

The bundled server is local-only stdio: it opens no TCP listener and writes no query logs. Workspace metadata uses repository-relative paths. Generated `.doghouse` graphs and observed facts are ignored by Git by default.

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

The gateway changes the security boundary. Require authentication, bind only to intended interfaces, and grant access only to the repositories the gateway must serve.

## Homebrew

```bash
brew tap specdog/tap
brew install dotdog
```

## npm

```bash
npm install -g dotdog
```

---

## Cloud Providers

dotdog verifies your infrastructure against live cloud resources. No credentials stored — reads from environment variables.

| Provider | Token env var | Setup |
|----------|-------------|-------|
| **Cloudflare** | `CLOUDFLARE_API_TOKEN` | [Create token](https://dash.cloudflare.com/profile/api-tokens) with R2/D1/Worker read permissions |
| **Supabase** | `SUPABASE_ACCESS_TOKEN` | [Generate access token](https://supabase.com/dashboard/account/tokens) |
| **Vercel** | `VERCEL_TOKEN` | [Create token](https://vercel.com/account/tokens) with read-only scope |
| **Netlify** | `NETLIFY_AUTH_TOKEN` | [Personal access token](https://app.netlify.com/user/applications#personal-access-tokens) |
| **Railway** | `RAILWAY_TOKEN` | [Generate token](https://railway.app/account/tokens) or use `railway login` |
| **AWS** | `AWS_PROFILE` | Uses existing `~/.aws/credentials` — no additional setup |

Define resources in an `### Infrastructure` block, run `dotdog compile`, then `dotdog live --type infra`.

```yaml
### Infrastructure
```yaml
resources:
  - provider: cloudflare
    resource: r2:my-bucket
    entity: FileStorage
  - provider: supabase
    resource: project:abc123xyz
    entity: Database
```
```

[Full infrastructure verification docs →](/dotdog/live-endpoint-testing)
