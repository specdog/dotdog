---
layout: default
title: Live endpoint and infrastructure checks
description: Explicit HTTP contract checks and read-only cloud resource lookups, with bounded requests and verification limits.
---

# dotdog live

`live` explicitly contacts URLs or cloud providers declared in the selected repository. Review untrusted contracts before running it. Local graph queries do not perform these checks automatically.

```sh
dotdog live --type endpoint --exit-code --timeout 5
dotdog live --type infra --exit-code
dotdog live Health --type endpoint --exit-code
```

`--type` accepts `endpoint`, `infra` or `all` (default). Timeouts must be greater than zero and at most 300 seconds. Credentials stay in the existing provider environment/configuration, not graph properties.

## Endpoint contracts

Compile a spec endpoint with `type: endpoint` and property defaults `url`, optional `backup_url`, `expect_status` (default 200), and optional `expect_body`. For example, a health contract can expect `{ ok: true }` from a repository-owned HTTP(S) URL.

1. Load endpoint definitions from compiled `.dag` graphs. If none are loaded, inspect source specs.
2. Contact the primary URL; on failure, try an explicitly configured backup.
3. Check HTTP status and the supplied expected JSON values recursively. Expected objects are subsets: extra actual object keys are allowed. Expected arrays must match length/order. Scalars, null, false and zero are compared exactly.
4. Reject embedded URL credentials and redirects. When JSON is required, read at most 1 MiB and retain the timeout through body reads.
5. Report a matching backup as degraded, not healthy primary service.

This is comparison against supplied examples, not JSON Schema validation or proof that an API is correct. Do not use example values such as IDs/timestamps when only their types should vary. A broken or incomplete contract can still miss application defects.

## Infrastructure mappings

An Infrastructure resources block records `provider`, `resource`, `entity`, optional AWS `region`, and optional Supabase `tables`. Compile before live checks when using `.dag` mappings.

| Provider | Supported resource mapping | Credentials | Check |
| --- | --- | --- | --- |
| Cloudflare | `r2:<bucket-name>`, `d1:<database-id>`, `worker:<script-name>`, `kv:<namespace-id>` | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` | Explicit account-scoped REST GET |
| Supabase | `project:<ref>` | `SUPABASE_ACCESS_TOKEN` | Project-list metadata; requested tables remain unverified |
| Vercel | `project:<name-or-id>`, `deployment:<id>` | `VERCEL_TOKEN` | REST metadata GET |
| Netlify | `site:<id>`, `deploy:<id>` | `NETLIFY_AUTH_TOKEN` | REST metadata GET |
| Railway | `service:<service-id>` | `RAILWAY_API_TOKEN` for account/workspace tokens, or `RAILWAY_TOKEN` for project tokens | Fixed GraphQL query with ID variable |
| AWS | `s3:<name>`, `lambda:<name-or-arn>`, `rds:<id>`, `dynamodb:<name>` | Installed AWS CLI credential configuration | Read-only CLI metadata lookup |

No provider MCP server is launched or probed. HTTP provider calls use fixed API origins and refuse redirects. AWS S3 verification checks bucket metadata, not a recursive object listing. Existence does not prove healthy deployment, authorization policy, data correctness or required table schemas. Output redaction is best-effort; do not include secrets in mapped names.

`live` uses loaded `.dag` infrastructure mappings directly, deduplicates them before provider calls, and falls back to source scanning only when no graph was loaded. MCP `infraVerify` uses a source scan and intersects optional provider/entity filters. Malformed source inputs fail rather than becoming an empty successful scan.

## Exit codes

Without `--exit-code`, results are diagnostic output; do not treat process success as verified contracts. With `--exit-code`:

| Code | Meaning |
| --- | --- |
| 0 | Requested checks passed |
| 1 | Contract mismatch, no matching requested checks, or infrastructure failed/warned/skipped |
| 2 | An endpoint could not be reached or a required body could not be read/parsed |
| 3 | Only a configured backup matched |

Malformed CLI/input errors return nonzero. Infrastructure results take precedence over endpoint status when both are requested. Provider fixtures test request construction and failure handling; live cloud account checks were not run for this candidate.

See [security audit](v1-security-audit.md) for verified findings and remaining boundaries.
