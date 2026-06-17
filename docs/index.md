---
layout: default
title: "dotdog — Specs that ship"
description: "CLI tool for structured software specs. Write .dog files, compile .dag graphs, query via MCP."
---

# dotdog

Write specs before code. Validate completeness. Compile to a graph AI agents can query. No hallucination.

## Install

```bash
npm install -g dotdog
```

## Try it

```bash
dotdog init my-app --minimal
dotdog validate         # → my-app: 100% complete — no gaps
dotdog compile          # → 94% smaller than source
dotdog serve            # → AI agents query your specs via MCP
```

100% complete means every spec file has content, every entity has properties, and no gaps were found. The dog checks your work.

## What you get

| | Before dotdog | With dotdog |
|---|-------------|------------|
| Specs | Written once, never updated | Validated on every commit |
| AI agents | Read prose, hallucinate | Query typed data via MCP |
| Drift | Discovered in production | Caught before merge |

## MCP Server

AI agents query your specs with zero hallucination. Add to any MCP client:

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

Six tools: `getEntity`, `traverse`, `search`, `schema`, `summary`, `listProjects`.

## More

- [Handbook: Spec-Driven Development](handbook)
- [Tutorial: Build a spec-driven project](tutorial)
- [Adding dotdog to an existing project](adopting)
- [Integrations](integrations)
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
