---
layout: post
title: "Your spec should test your API. Introducing dotdog live."
date: 2026-06-18
---

# Your spec should test your API

We've all been there. You update an endpoint response shape. Something downstream breaks at 2am. The person on call has no idea what changed because the spec and the code drifted apart months ago.

dotdog already validates that your spec is complete and consistent. Now it validates that your spec matches reality.

## dotdog live

```bash
dotdog live --exit-code
```

That's it. One command. dotdog scans your `.dog` files for `type: endpoint` entities, hits every URL, diffs the JSON response against your expected schema, and exits with a status code.

```
  ✓ memory-api
  ✓ user-api
  ⚠ search-api: https://backup.search.sh (backup, primary failed)
  ✗ status-api: https://api.example.test — missing fields: status_code

  4 endpoints: 2 passed, 1 degraded, 1 failed
```

## The spec IS the contract

You already define your data model in dotdog. Adding an endpoint contract is one YAML block:

```yaml
entity: memory-api
type: endpoint
properties:
  url:
    type: string
    default: https://api.collar.sh/v1/memory
  expect_body:
    type: json
    default:
      memory_enabled: true
      recall_validate: true
```

dotdog live hits that URL, checks that `memory_enabled` and `recall_validate` are both present, and reports back. If someone deploys a change that drops `recall_validate`, the CI goes red.

## Backup failover

Production has outages. Your contract testing shouldn't fail just because one server is down.

```yaml
  backup_url:
    type: string
    default: https://backup.collar.sh/v1/memory
```

If the primary is unreachable, dotdog tries the backup. If the backup matches, you get a warning — not a failure. If both are down, that's a real alert.

## In CI

```yaml
- run: dotdog live --exit-code
```

Exit 0 = all good. Exit 1 = drift (schema mismatch). Exit 2 = unreachable (both down). Exit 3 = degraded (backup used).

Your spec is now a living, breathing contract. Not a document that rots in a `/docs` folder. A guardrail that catches drift at PR time, not at 2am.

[Get started with dotdog live →](/live-endpoint-testing)
