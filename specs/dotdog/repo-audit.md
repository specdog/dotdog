# dotdog repo audit

Date: 2026-06-19
Scope: local checkout on origin/main, dotdog DAG-first review, GitHub issues/PRs, spec alignment.

## Current state

### Implemented / present
- Core CLI exists: validate, analyze, generate, simulate, compile, visualize, serve, staleness, tokens, parse, init, list, woof, live.
- MCP server exists with tools: getEntity, traverse, search, listProjects, summary, schema, infraVerify.
- .dag graph exists and is queryable.
- Spec docs exist for product, constitution, data model, and plan.
- Open PRs are minimal: one open PR at the time of audit.

### Repo intelligence from MCP
- MCP tool list loaded successfully.
- Projects visible via MCP: dotdog, infra-fixture.
- dotdog summary via MCP: nodes=9, edges=9, savings=95.
- Search tool was available but timed out in this run; summary and project enumeration worked.

## Open GitHub work

### Issues
- #259 feat: analyze --issues (drift discovery in context)
- #258 feat: MCP tools for initGuided and checkIssues
- #257 feat: issues --check (validate spec against GitHub issues)
- #256 feat: init --guided (interactive setup)
- #231 good first issue: add ai-agent kit template
- #220 good first issue: add SaaS kit template
- #219 good first issue: add CLI tool kit template
- #218 good first issue: add blog kit template
- #185 feat: community kit contribution system

### PRs
- #262 docs: remove named agent from FAQ

## Gap analysis

### Missing but already promised in spec/plan
- Issue coverage tooling
  - `dotdog issues --check`
  - `dotdog analyze --issues`
  - MCP `checkIssues`
- Guided onboarding
  - `dotdog init --guided`
- New kit/template support
  - ai-agent
  - SaaS
  - CLI tool
  - blog
- Community contribution flow for kits
- Broader drift reporting between issues/spec/code

### Stale or contradictory
- The product spec still implies a broader dashboard and predictive/product surface than the current CLI/MCP core.
- Plan has later phases marked aspirational; current implementation work should stay on repo intelligence and issue-sync first.

## Suggested execution order
1. Issue sync / coverage
   - implement `issues --check`
   - implement `analyze --issues`
   - expose issue coverage through MCP
2. Guided setup
   - implement `init --guided`
3. Template expansion
   - ship the kit templates currently tracked as issues
4. Drift reporting
   - create spec-vs-issue-vs-code status output
5. Broader graph features
   - traversal / completion probability / richer simulation

## New issues worth creating if needed
- Spec coverage report command
- MCP tool to list unresolved spec gaps
- Dashboard for issue/spec drift
- Kit template validation command
- Auto-create issues from uncovered spec gaps

## Notes
- I used the local dotdog MCP server for repo discovery and project summary.
- The repo is still aligned to the spec-first model, but the issue-sync layer is the highest-leverage missing piece.
