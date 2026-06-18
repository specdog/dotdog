# CLAUDE.md — dotdog integration for Claude Code

## Dotdog MCP Server

This project uses **dotdog** for structured specifications. Query the
dotdog MCP server before any coding task involving entities or
relationships defined in specs.

### MCP Config

Add to your Claude Code MCP config (`~/.claude/mcp.json` or project
`.mcp.json`):

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog@latest", "serve"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `getEntity` | Entity with properties, states, lifecycle, edges |
| `traverse` | BFS subgraph from any node, depth 1-20 |
| `search` | Find entities by name or type |
| `schema` | Property definitions only |
| `summary` | Node/edge counts, token savings |
| `listProjects` | All spec project names |

### Standard Workflow

1. Run `dotdog doctor` to verify specs are clean
2. Call `listProjects` to find the project
3. Call `getEntity` for entities relevant to the task
4. Call `traverse` to explore connected entities
5. Code with full context — zero hallucination

### Spec Files

```
specs/<project>/SPEC.dog          # product spec with screens and flows
specs/<project>/data-model.dog    # entities, properties, relationships, states
specs/<project>/constitution.dog  # rules, tech constraints, governance
specs/<project>/plan.dog          # phases, tasks, predictions
```

### CI

```bash
dotdog doctor   # baseline health — required files + stale .dag detection
dotdog validate # full completeness check
```

NEVER read .dog files directly. Always query via MCP. The .dag is the
agent format — 94% smaller, zero prose, pure structure.
