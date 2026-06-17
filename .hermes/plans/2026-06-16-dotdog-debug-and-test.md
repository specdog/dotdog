# dotdog: Test & Cleanup Plan

> **Public npm package.** Test the shipped artifact. Delete dead code. Minimal, focused.

**Goal:** Working test suite for dotdog. Clean repo. CI catches regressions.

**Reality check:**
- spec-engine: shared lib (used by spec-cli, spec-mcp). Has its own parser — diverged from dotdog's.
- spec-cli: original CLI, replaced by dotdog rewrite. Different dir layout. Nothing imports it. Dead.
- spec-mcp: separate MCP server using spec-engine + @modelcontextprotocol/sdk. Also dead — dotdog has `serve` command that does the same thing inline.
- dotdog: the shipped product. Self-contained. 1809 lines. What matters.

**Best practice for npm CLI packages:**
- Unit test the parser (fast, isolated, catch regressions)
- Integration test CLI commands via subprocess (smoke test the shipped artifact)
- Snapshot test output format (catch unintended output changes)
- CI: build → test → version → publish
- Delete code that isn't shipped

---

## Task 1: Delete spec-cli and spec-mcp

**Why:** Dead code. Never shipped. dotdog replaced both. Confuses the repo.

**Files:**
- Delete: `packages/spec-cli/`
- Delete: `packages/spec-mcp/`

**Step 1: Remove directories**

```bash
rm -rf packages/spec-cli packages/spec-mcp
```

**Step 2: Remove from workspaces**

```patch
// package.json — remove spec-cli and spec-mcp from workspaces array if listed
```

**Step 3: Verify nothing breaks**

```bash
cd /Users/dico/specdog && bun install
bun packages/dotdog/src/cli.ts validate
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead spec-cli and spec-mcp packages"
```

---

## Task 2: Unit test the parser

**Why:** Parser is the core engine. 473 lines. No tests. Every feature change risks breaking parse.

**Files:**
- Create: `packages/dotdog/__tests__/parser.test.ts`

**Tests to write:**

1. Empty document → valid AST
2. Headings → correct sections
3. Entity with YAML → name, properties, states, lifecycle parsed
4. Entity without YAML → defaults filled
5. Relationship → source, target, verb parsed
6. Multiple entities in one file
7. Real data-model.dog → 8 entities, 5 relationships
8. parseToJSON → valid JSON string
9. Table parsing → headers + rows
10. Prediction block → confidence, timeframe parsed

**Step 1: Create test file**

```typescript
// packages/dotdog/__tests__/parser.test.ts
import { describe, test, expect } from 'bun:test';
import { parse, parseToJSON } from '../src/parser';
import { readFileSync } from 'fs';

describe('parser', () => {
  test('empty document', () => {
    const ast = parse('');
    expect(ast.kind).toBe('document');
  });

  test('headings', () => {
    const ast = parse('## Product\n\ntext\n\n### Entity: User\n');
    const headings = ast.sections.map(s => s.heading);
    expect(headings).toContain('Product');
    expect(headings).toContain('Entity: User');
  });

  test('entity with YAML', () => {
    const doc = `### Entity: User

A user.

\`\`\`
entity: User
type: entity
properties:
  email:
    type: string
    required: true
states: [active, suspended]
lifecycle: active → suspended
\`\`\``;
    const ast = parse(doc);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    expect(entities.length).toBe(1);
    const e = entities[0] as any;
    expect(e.name).toBe('User');
    expect(e.properties.email.type).toBe('string');
    expect(e.properties.email.required).toBe(true);
    expect(e.states).toEqual(['active', 'suspended']);
    expect(e.lifecycle.length).toBe(1);
  });

  test('entity without YAML — defaults', () => {
    const doc = '### Entity: Guest\n\nJust a guest.';
    const ast = parse(doc);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    expect(entities.length).toBe(1);
    const e = entities[0] as any;
    expect(e.name).toBe('Guest');
    expect(e.properties).toEqual({});
    expect(e.states).toEqual([]);
  });

  test('relationship', () => {
    const doc = `### Relationship: User → Order

\`\`\`
verb: places
cardinality: 1:N
required: true
\`\`\``;
    const ast = parse(doc);
    const rels = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship'));
    expect(rels.length).toBe(1);
    const r = rels[0] as any;
    expect(r.source).toBe('User');
    expect(r.target).toBe('Order');
    expect(r.verb).toBe('places');
    expect(r.required).toBe(true);
  });

  test('prediction', () => {
    const doc = `### Prediction: Market grows

\`\`\`
trigger: new regulation
timeframe: 6 months
confidence: 85
measurement: market cap
\`\`\``;
    const ast = parse(doc);
    const preds = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'prediction'));
    expect(preds.length).toBe(1);
    const p = preds[0] as any;
    expect(p.confidence).toBe(85);
    expect(p.timeframe).toBe('6 months');
  });

  test('real data-model.dog', () => {
    const content = readFileSync('projects/spec-platform/data-model.dog', 'utf-8');
    const ast = parse(content);
    const entities = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'entity'));
    const rels = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'relationship'));
    expect(entities.length).toBe(8);
    expect(rels.length).toBe(5);
  });

  test('parseToJSON', () => {
    const json = parseToJSON('### Entity: Test\n');
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe('document');
  });

  test('table parsing', () => {
    const doc = `| Name | Type |\n|------|------|\n| id   | string |\n| email | string |`;
    const ast = parse(doc);
    const tables = ast.sections.flatMap(s => s.blocks.filter(b => b.kind === 'table'));
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const t = tables[0] as any;
    expect(t.headers).toEqual(['Name', 'Type']);
    expect(t.rows.length).toBe(2);
  });
});
```

**Step 2: Run**

```bash
cd /Users/dico/specdog && bun test
```

Expected: 9 tests pass.

**Step 3: Commit**

```bash
git commit -m "test: add parser unit tests"
```

---

## Task 3: Integration test CLI commands

**Why:** Catch regressions in the shipped CLI. Bun's `$` shell is fast and built-in.

**Files:**
- Create: `packages/dotdog/__tests__/cli.test.ts`

**Tests:**

```typescript
import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

const CLI = 'bun packages/dotdog/src/cli.ts';

describe('CLI', () => {
  test('--version', async () => {
    const out = await $`${CLI} --version`.text();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('--help', async () => {
    const out = await $`${CLI} --help`.text();
    expect(out).toContain('validate');
    expect(out).toContain('compile');
    expect(out).toContain('serve');
  });

  test('validate', async () => {
    const result = await $`${CLI} validate`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('analyze', async () => {
    const result = await $`${CLI} analyze`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('staleness', async () => {
    const result = await $`${CLI} staleness`.quiet();
    expect(result.exitCode).toBe(0);
  });

  test('list shows spec-platform', async () => {
    const out = await $`${CLI} list`.text();
    expect(out).toContain('spec-platform');
  });

  test('compile creates .dag', async () => {
    const result = await $`${CLI} compile`.quiet();
    expect(result.exitCode).toBe(0);
    const dag = Bun.file('projects/spec-platform/spec-platform.dag');
    expect(await dag.exists()).toBe(true);
  });

  test('parse shows sections', async () => {
    const out = await $`${CLI} parse projects/spec-platform/SPEC.dog`.text();
    expect(out).toContain('sections');
  });

  test('kit list', async () => {
    const out = await $`${CLI} kit list`.text();
    expect(out).toContain('erc20');
    expect(out).toContain('nft');
  });

  test('predictions', async () => {
    const result = await $`${CLI} predictions`.quiet();
    expect(result.exitCode).toBe(0);
  });
});
```

**Step 1: Create and run**

```bash
bun test
```

Expected: 10 tests pass.

**Step 2: Commit**

```bash
git commit -m "test: add CLI integration tests"
```

---

## Task 4: Snapshot test key outputs

**Why:** Catch unintended output changes. Bun has built-in snapshot support.

**Files:**
- Create: `packages/dotdog/__tests__/__snapshots__/` (auto-created by bun)

**Add to cli.test.ts:**

```typescript
test('validate output snapshot', async () => {
  const out = await $`${CLI} validate`.text();
  expect(out).toMatchSnapshot();
});

test('list output snapshot', async () => {
  const out = await $`${CLI} list`.text();
  expect(out).toMatchSnapshot();
});
```

**Step 1: Run to generate snapshots**

```bash
bun test --update-snapshots
```

**Step 2: Commit**

```bash
git commit -m "test: add output snapshot tests"
```

---

## Task 5: Add test script to package.json

**Files:**
- Modify: `package.json`

```json
"scripts": {
  "test": "bun test",
  ...
}
```

---

## Task 6: Run full CI pipeline locally

```bash
cd packages/dotdog && bun install
bun build src/cli.ts --outdir dist --target node
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js validate
node dist/cli.js analyze
node dist/cli.js staleness
node dist/cli.js list
bun test
```

---

## What's NOT in this plan

- **No de-duplication** — dotdog is self-contained by design. spec-engine parser diverged (has Prediction support dotdog doesn't).
- **No spec-engine tests** — not the shipped package. Test the dotdog parser instead (the one that matters).
- **No kit functional tests** — kits are templates, validated by `validate` after init. Integration test covers `kit list`.
- **No VS Code extension test** — separate artifact, not in npm package scope.
