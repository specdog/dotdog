---
layout: default
title: "Google's Agentic Resource Discovery Is the Missing Layer of the Agent Internet"
date: 2026-06-18
author: Justin Diclemente
description: "Google just announced ARD — an open spec for discovering and verifying AI tools, agents, and skills across the web. Here's how it fits with MCP, A2A, and llms.txt, and why the agent internet just got its DNS."
---

# Google's Agentic Resource Discovery Is the Missing Layer of the Agent Internet

On June 17, 2026, Google announced the [Agentic Resource Discovery (ARD)](https://developers.googleblog.com/en/announcing-the-agentic-resource-discovery-specification/) specification. It's an open standard for publishing, discovering, and verifying AI capabilities across the web. Think of it as DNS for agents.

This isn't another protocol. It's the layer that makes all the other protocols work together.

## The Stack Before ARD

Before yesterday, the agent internet had three major standards, but they didn't talk to each other:

- **llms.txt** (Sept 2024, Jeremy Howard) — tells agents what's on a website. Flat markdown.
- **MCP** (Nov 2024, Anthropic) — connects agents to tools. Stdio or HTTP transport.
- **A2A** (April 2025, Google) — lets agents talk to other agents. Task-based protocol.

Each standard solved a piece of the puzzle. But the piece nobody solved: **how does an agent find the right tool in the first place?**

If an agent needs a weather API, it can't query every MCP server on the internet. If it needs a payment processor, it can't scan every `llms.txt` file. There was no search layer. No discovery layer.

ARD is that layer.

## How ARD Works

ARD uses two primitives:

1. **Catalogs** — an `ai-catalog.json` file you host on your domain. It lists what you offer: MCP servers, A2A agents, OpenAPI tools, or nested catalogs. Because it's served from your domain, the domain itself becomes the root of trust.

```json
{
  "name": "Example Corp Agent Hub",
  "capabilities": [
    {
      "type": "mcp",
      "name": "Weather MCP Server",
      "url": "https://example.com/weather/mcp",
      "description": "Real-time weather data for any location"
    },
    {
      "type": "a2a", 
      "name": "Customer Support Agent",
      "url": "https://example.com/support/a2a",
      "description": "Handles refunds, returns, and account issues"
    },
    {
      "type": "openapi",
      "name": "Inventory REST API",
      "url": "https://example.com/inventory/openapi.json",
      "description": "Warehouse stock levels and order fulfillment"
    }
  ]
}
```

2. **Registries** — search engines that crawl these catalogs. An agent sends a plain-language query ("I need weather data for Los Angeles") and the registry returns matching capabilities with cryptographic verification metadata.

The magic: after discovery, ARD steps out of the way. The agent connects directly using whatever native protocol the tool uses — MCP, A2A, OpenAPI, whatever. ARD doesn't replace MCP. It makes MCP findable.

## The Demo Is Worth Watching

Google's demo video shows an agent discovering and executing completely new capabilities at runtime. Four phases:

1. **Publish** — provider hosts an `ai-catalog.json` on their domain
2. **Discover** — client agent queries a registry with a plain-language intent
3. **Verify** — cryptographic check confirms the publisher's identity
4. **Connect** — agent loads the capability and uses its native protocol

This is the moment the agent internet becomes an actual internet. Before ARD, agents could only use tools they were pre-configured with. After ARD, they can discover tools they've never heard of.

## How It Fits With Everything Else

The complete agent stack now looks like this:

| Layer | Standard | Question It Answers |
|-------|----------|-------------------|
| Discovery | **ARD** (Google, June 2026) | Where is the right tool? |
| Site map | **llms.txt** (Jeremy Howard, Sept 2024) | What's on this website? |
| Transport | **MCP** (Anthropic, Nov 2024) | How do I call the tool? |
| Collaboration | **A2A** (Google, April 2025) | How do agents work together? |
| Specs | **.dog/.dag** (dotdog, June 2026) | What are the entities and rules? |

Each layer answers a different question. Together, they form a complete stack for agents to navigate the web the way browsers navigate it for humans.

## What This Means for Developers

If you build tools agents might use — APIs, MCP servers, A2A agents, anything — you should publish an `ai-catalog.json` on your domain. It's a one-time setup. The [quickstart guide](https://developers.googleblog.com/en/announcing-the-agentic-resource-discovery-specification/) walks through it.

Once your catalog is up, registries will crawl it. Agents will find your tools. And because ARD includes cryptographic verification, they'll trust them.

This is the same shift that happened with web search in the 90s. Before Google, you had to know a URL to visit a site. After Google, you could search for what you needed and discover sites you'd never heard of. ARD does this for agents.

## The Open Question

ARD solves discovery. But what happens after the agent connects?

It finds a catalog entry: "MCP server at this URL." It connects. It gets a list of tools. But how does it know what those tools *mean*? What entities they operate on? What states those entities go through? How they relate to each other?

That's the next layer. Discovery gets you to the door. Content tells you what's inside.

---

**Sources:**
- [Google ARD Announcement](https://developers.googleblog.com/en/announcing-the-agentic-resource-discovery-specification/), June 17, 2026
- [llms.txt proposal](https://llmstxt.org/), Jeremy Howard, Sept 2024
- [Anthropic MCP](https://modelcontextprotocol.io/), Nov 2024
- [Google A2A](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/), April 2025
