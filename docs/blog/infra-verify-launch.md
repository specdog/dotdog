---
layout: post
title: "Your spec says you have an S3 bucket. Prove it."
description: "dotdog 0.8.6 ships infrastructure verification — map spec entities to live cloud resources and verify they exist. Six providers. MCP-first. Zero credential exposure."
date: 2026-06-19
categories: release
---

Your `.dog` spec declares a `FileStorage` entity. The prose says it maps to an S3 bucket called `uploads-prod`. But does that bucket actually exist? Is it in the right region? Did someone delete it six months ago and nobody updated the spec?

**dotdog 0.8.6 answers this.** 

`dotdog live` now does two things: hit HTTP endpoints (shipped in 0.8.5) and verify cloud infrastructure exists (new in 0.8.6). One command, one contract, reality checked.

## The problem

Specs rot. They describe a world that may not exist anymore. An engineer decommissions a service. A bucket gets renamed. A Vercel project gets deleted. The spec stays frozen in time — until someone wastes hours debugging a ghost.

Existing tools don't bridge this gap:
- **Terraform** detects drift between state files and deployed resources — but only if you're using Terraform
- **Steampipe** queries cloud APIs with SQL — but doesn't connect to your spec
- **Datadog/PagerDuty** monitor health — but don't know what you *said* you deployed

Nobody asks: *does your spec match reality?*

## How it works

Add an `### Infrastructure` block to any `.dog` file:

```yaml
### Infrastructure
```yaml
resources:
  - provider: aws
    resource: s3:uploads-prod
    entity: FileStorage
    region: us-east-1
  - provider: vercel
    resource: project:my-frontend
    entity: WebApp
  - provider: supabase
    resource: project:abc123xyz
    entity: Database
    tables: [users, posts, sessions]
```
```

Run `dotdog compile` to bake these into the `.dag` graph — they become nodes with `maps_to` edges to your spec entities. Then:

```bash
dotdog live --type infra
```

```
Infrastructure
  ✓ FileStorage    aws s3:uploads-prod            exists (us-east-1)
  ✗ WebApp         vercel project:my-frontend     not found (404)
  ✓ Database       supabase project:abc123        healthy
  ✓ Database       → table users                   5 columns
  ✓ Database       → table posts                   8 columns
  ✓ Database       → table sessions                4 columns

  5/6 checks passed. 1 resource missing.
```

The Vercel project is gone. Now you know — before it causes an incident.

## Six providers, one interface

| Provider | Resources | Method |
|----------|----------|--------|
| Cloudflare | R2, D1, Workers, KV | MCP (official) |
| Supabase | Projects, tables, storage | MCP (official) |
| Vercel | Projects, deployments | REST API |
| Netlify | Sites, deploys | REST API |
| Railway | Services | MCP (CLI) |
| AWS | S3, Lambda, RDS, DynamoDB | AWS CLI |

MCP-first architecture. When a provider has an MCP server (Cloudflare, Supabase, Railway), dotdog connects to it directly. When they don't (Vercel, Netlify), it falls back to REST. AWS uses the CLI you already have configured.

## Zero credentials

dotdog never stores, logs, or transmits credentials. It reads from environment variables:

```bash
export CLOUDFLARE_API_TOKEN="..."
export SUPABASE_ACCESS_TOKEN="..."
export VERCEL_TOKEN="..."
```

That's it. No config file. No secrets in your spec. Output is masked — you'll never see `AKIA...` in your terminal.

## DAG-powered

Infrastructure resources are compiled into the `.dag` graph alongside your entities and relationships. `dotdog live --type infra` queries the `.dag` — not raw `.dog` files. This means:

- **94% token savings**: the dotdog project's own specs go from 8,563 tokens (raw .dog) to 512 tokens (compiled .dag)
- **Instant**: pre-parsed, no filesystem scanning
- **Agent-native**: the `infraVerify` MCP tool exposes this to any AI agent via `npx dotdog serve`

```json
// Agent calls MCP tool
{ "method": "tools/call", "params": { "name": "infraVerify", "arguments": { "provider": "aws" } } }
// Returns verified resources immediately
```

## CI integration

```yaml
# .github/workflows/spec-check.yml
- run: dotdog live --exit-code
```

Your PR gets blocked if a resource is missing. The spec IS the contract.

## What's next

More providers (Fly.io, Render, PlanetScale). Provisioning (create missing resources). Drift detection over time. But this is the foundation: **your spec can now tell you when reality diverges.**

---

Install: `npm install -g dotdog@0.8.6`  
Docs: [Live Testing](/dotdog/live-endpoint-testing)  
Source: [github.com/specdog/dotdog](https://github.com/specdog/dotdog)
