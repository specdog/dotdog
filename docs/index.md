---
layout: default
title: "dotdog — Spec-driven development CLI"
description: "Write structured specs. Validate completeness. Compile to graphs. AI agents query via MCP."
---

# dotdog

> Spec-driven development CLI. Write structured specs, validate completeness, compile to graphs, and let AI agents query them via MCP.

## Install

```bash
npm install -g dotdog
```

## How it works

```
$ dotdog init my-project --minimal       # scaffold a spec genome
$ dotdog validate                        # score completeness
$ dotdog compile                         # build .dag graph (94% savings)
$ dotdog serve                           # expose to AI agents via MCP
```

### What each step does

**init** creates `.dog` spec files — structured Markdown with typed YAML entities. Start describing your product, its data model, and user stories.

**validate** scores completeness. Missing entities? Empty descriptions? Unreferenced relationships? The dog finds the gaps.

**compile** builds a positional `.dag` graph. 94% smaller than the source — AI agents load exact data, not prose.

**serve** starts an MCP server over stdio. Any MCP-compatible agent queries your spec: `getEntity`, `traverse`, `search`, `schema`, `summary`, `listProjects`. Zero hallucination.

## AI Agent Setup

Add to any MCP client (Claude Desktop, Cursor, Copilot):

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

Run `dotdog compile` first to generate the `.dag` files.

## More

- [Handbook: Spec-Driven Development](handbook)
- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [FAQ](faq)
- [All Commands](#commands)

---

dotdog@<span id="version">0.5.0</span> · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE) · [GitHub](https://github.com/specdog/dotdog) · [npm](https://www.npmjs.com/package/dotdog)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "dotdog",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Linux, macOS, Windows",
  "description": "CLI tool for structured software specs. Validate .dog files, compile .dag graphs, query via MCP.",
  "url": "https://specdog.github.io/dotdog",
  "offers": { "@type": "Offer", "price": "0" }
}
</script>

<script>
async function loadVersion(){try{const r=await fetch('https://registry.npmjs.org/dotdog/latest');const d=await r.json();document.getElementById('version').textContent=d.version;}catch(e){}}
loadVersion();
</script>
