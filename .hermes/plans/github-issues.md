# GitHub Issue Plan

3 issues. All from this PR.

---

## Issue 1: `dotdog visualize` produces empty Mermaid graph

**Title:** `dotdog visualize` broken — empty Mermaid output since v1.5 compiler migration

**Labels:** bug

**Body:**
```
### What
`dotdog visualize` always outputs an empty Mermaid graph:

```
```mermaid
graph LR
```
```

### Why
The compile command outputs v1.5 compact .dag format with keys `n` (nodes), `i` (id), inlined `es` (edges). The visualize command reads legacy v1.3 keys: `dag.nodes`, `n.id`, `dag.edges`, `e.source`, `e.verb`. All undefined.

### Fix
Update visualize to read v1.5 keys with v1.3 fallback:
- `dag.n || dag.nodes` for nodes
- `n.i || n.id` for node id
- `n.es` for inline edges (filter `dir: 'in'` to deduplicate)
- `dag.e || dag.edges` for legacy top-level edges

Also fix `--save` path: writes to `projects/<name>/<name>.md` instead of `projects/<name>.md`.

### Reproduce
```bash
dotdog compile
dotdog visualize  # empty
```
```

---

## Issue 2: Debug leftover `|| true` in resolve command

**Title:** Resolve command has debug leftover `|| true` — always-true condition

**Labels:** cleanup

**Body:**
```
### What
Line 760: `if (headingIdx >= 0 || true)` — always true. Dead condition.

### Why
Leftover from debugging. The `|| true` forces entry into the block even when the prediction heading isn't found. Guard at line 765 prevents actual corruption, but the dead `startIdx` ternary is misleading.

### Fix
Remove `|| true`. Simplify dead `startIdx` ternary to just use `headingIdx`.
```

---

## Issue 3: Silent `catch {}` in staleness command

**Title:** Staleness swallows JSON parse errors with empty catch

**Labels:** cleanup

**Body:**
```
### What
Line 621: `try { JSON.parse(...) } catch {}` — silent error swallow.

### Why
Tries to read `packages/dotdog/package.json` for version check. If file doesn't exist or is invalid JSON, error silently disappears.

### Fix
Check `existsSync` before reading, skip gracefully. No try/catch needed.
```
