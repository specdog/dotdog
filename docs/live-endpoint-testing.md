---
layout: default
title: "Live Endpoint Testing — dotdog live"
description: "Test live endpoints against .dog contracts. Hit URLs, diff responses, failover to backup. Exit codes for CI."
---

# dotdog live

> Your `.dog` spec is the contract. `dotdog live` enforces it against real endpoints.

Define an endpoint entity in any `.dog` file, and `dotdog live` will hit the URL, diff the response against your expected schema, and report drift. Never wonder if your API matches your spec again.

## Quick Start

```bash
dotdog live              # test all endpoint contracts
dotdog live my-api       # test one
dotdog live --exit-code  # CI mode: non-zero on drift
dotdog live --timeout 5  # 5-second timeout per request
```

## Define a contract

Add an endpoint entity to any `.dog` file in your project:

```yaml
### Endpoint: memory-api

```yaml
entity: memory-api
type: endpoint
properties:
  url:
    type: string
    default: https://api.collar.sh/v1/memory
  backup_url:
    type: string
    default: https://backup.collar.sh/v1/memory
  expect_status:
    type: number
    default: 200
  expect_body:
    type: json
    default:
      memory_enabled: true
      recall_validate: true
  timeout:
    type: number
    default: 10
```
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All contracts match |
| 1 | Schema drift (missing field, wrong value) |
| 2 | Unreachable (both primary and backup down) |
| 3 | Degraded (backup used, primary failed) |

Use `--exit-code` to get these codes for CI pipelines.

## How it works

1. Scans all `.dog` files in the project for `type: endpoint` entities
2. For each endpoint, hits the primary URL
3. If primary fails, tries the backup URL
4. Diffs the JSON response against `expect_body`
5. Missing fields → drift (fail). Extra fields → warn.
6. Reports: passing / degraded / failing / unreachable

## CI integration

```yaml
- run: dotdog live --exit-code
```

Your PR gets blocked if the live endpoints don't match the spec. The spec IS the contract.
