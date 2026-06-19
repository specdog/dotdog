---
layout: default
title: "Live Testing — dotdog live"
description: "Test live endpoints and cloud infrastructure against .dog contracts. Hit URLs, diff responses, verify S3 buckets, Vercel projects, Supabase tables, and more."
---

# dotdog live

> Your `.dog` spec is the contract. `dotdog live` enforces it against reality.

Two modes: **endpoint testing** (HTTP) and **infrastructure verification** (cloud resources). One command. DAG-powered for speed.

## Quick Start

```bash
dotdog live                    # test everything (endpoints + infra)
dotdog live --type endpoint    # HTTP endpoints only
dotdog live --type infra       # cloud infrastructure only  
dotdog live my-api             # filter by entity name
dotdog live --exit-code        # CI mode: non-zero on drift/unreachable
dotdog live --timeout 5        # 5-second timeout per request
```

---

## Endpoint Testing

Define an endpoint entity in any `.dog` file, and `dotdog live` hits the URL, diffs the response against your expected schema, and reports drift.

### Define a contract

```yaml
### Endpoint: memory-api

```yaml
entity: memory-api
type: endpoint
properties:
  url:
    type: string
    default: https://api.example.com/v1/memory
  backup_url:
    type: string
    default: https://backup.example.com/v1/memory
  expect_status:
    type: number
    default: 200
  expect_body:
    type: json
    default:
      memory_enabled: true
      recall_validate: true
```
```

### How endpoint testing works

1. Scans `.dag` (compiled graph) for `type: endpoint` entities — token-efficient, no re-parsing
2. For each endpoint, hits the primary URL
3. If primary fails, tries the backup URL
4. Diffs the JSON response against `expect_body`
5. Missing fields → drift (fail). Extra fields → warn.

---

## Infrastructure Verification

Map spec entities to live cloud resources. `dotdog live --type infra` verifies they exist — no credentials stored, no secrets exposed.

### Define infrastructure

Add an `### Infrastructure` block to any `.dog` file:

```yaml
### Infrastructure

```yaml
resources:
  - provider: cloudflare
    resource: r2:user-avatars
    entity: FileStorage
  - provider: supabase
    resource: project:abc123xyz
    entity: Database
    tables: [users, posts, sessions]
  - provider: vercel
    resource: project:my-frontend
    entity: WebApp
  - provider: netlify
    resource: site:my-landing-page
    entity: LandingPage
  - provider: railway
    resource: service:api
    entity: ApiServer
  - provider: aws
    resource: s3:uploads-prod
    entity: FileStorage
    region: us-east-1
```
```

### Supported providers

| Provider | Resource types | Auth | Method |
|----------|---------------|------|--------|
| **Cloudflare** | R2 buckets, D1 databases, Workers, KV namespaces | `CLOUDFLARE_API_TOKEN` | MCP-first, REST fallback |
| **Supabase** | Projects, database tables, storage buckets | `SUPABASE_ACCESS_TOKEN` | MCP-first, REST fallback |
| **Vercel** | Projects, deployments | `VERCEL_TOKEN` | REST API |
| **Netlify** | Sites, deploys | `NETLIFY_AUTH_TOKEN` | REST API |
| **Railway** | Services | `RAILWAY_TOKEN` | MCP (bundled in CLI), REST fallback |
| **AWS** | S3 buckets, Lambda functions, RDS instances, DynamoDB tables | `AWS_PROFILE` or `~/.aws/credentials` | AWS CLI |

### How infra verification works

1. Compile your specs: `dotdog compile` — infra resources become `.dag` nodes with `maps_to` edges
2. `dotdog live --type infra` queries the `.dag` (94% smaller than raw `.dog` files)
3. For each resource, connects to the provider's MCP server or REST API
4. Verifies the resource exists, reports status
5. Zero credential exposure — reads from env vars, output is masked

### Example output

```
Infrastructure
  ✓ FileStorage    cloudflare r2:user-avatars     exists (12 objects)
  ✓ Database       supabase project:abc123        healthy
  ✓ Database       → table users                   5 columns
  ✓ Database       → table posts                   8 columns
  ✗ WebApp         vercel project:my-frontend     not found (404)
  ✓ ApiServer      railway service:api            healthy (us-west1)
  ✓ FileStorage    aws s3:uploads-prod            exists (us-east-1)

  6/7 checks passed. 1 resource missing.
```

---

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All contracts match / all resources verified |
| 1 | Schema drift (missing field, wrong value) or resource missing |
| 2 | Unreachable (both primary and backup down) |
| 3 | Degraded (backup used, primary failed) |

Use `--exit-code` for CI pipelines.

```yaml
# GitHub Actions
- run: dotdog live --exit-code
```

---

## DAG-powered performance

`dotdog live` queries the compiled `.dag` graph — not raw `.dog` files. This means:

- **Token savings**: `.dag` is 53-94% smaller than raw `.dog` files
- **Speed**: pre-parsed, no re-scanning the filesystem
- **Agent-friendly**: MCP `infraVerify` tool reads directly from the loaded `.dag`

Always run `dotdog compile` before `dotdog live` for maximum speed.

---

## MCP integration

Agents can run infra verification without the CLI:

```
Tool: infraVerify
Description: Verify infrastructure resources against live cloud
Parameters:
  provider (optional): cloudflare, supabase, vercel, netlify, railway, aws
  entity (optional): filter by spec entity name
```

Connect via `npx dotdog serve` — same MCP server, now with 7 tools.
