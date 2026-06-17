---
layout: default
title: "Troubleshooting"
description: "Common dotdog error messages and how to fix them."
---

← [specdog](https://specdog.github.io) · [guide](https://specdog.github.io/handbook) · [for agents · dogfood](https://specdog.github.io/agents)



## No projects found

You may see:

```text
No projects found. Run: spec init <project>
```

This means dotdog did not find a spec project in the current directory. Run the command from your project root, or create a spec project first:

```bash
dotdog init my-project
dotdog validate
```

For an existing codebase, see [Adding dotdog to an existing project](adopting.md).

## Missing required files

You may see:

```text
my-project : 2 .dog files, 65% complete
  Missing required: constitution.dog
  Missing optional: COPY.dog, plan.dog, DESIGN-SYSTEM.dog, INDEX.dog
```

This means the project is parseable, but the spec genome is incomplete. Add the required file, then run validation again:

```bash
dotdog validate
```

If the missing file can be inferred from `SPEC.dog`, run:

```bash
dotdog generate
dotdog validate
```

If the file is not generated, create it manually or copy the matching template from a new throwaway project made with `dotdog init`.

## No SPEC.dog found

You may see:

```text
No SPEC.dog found. Create one first.
```

`dotdog generate` needs a `SPEC.dog` source file before it can create supporting files. Start a project, or move into the directory that already contains your specs:

```bash
dotdog init my-project
dotdog generate
```

## Unknown relationship target

You may see:

```text
✗ Unknown relationship target "Payment" (source: "User")
```

The relationship points at an entity that dotdog cannot find. Check that both entity names exist and match exactly, including capitalization:

```yaml
entity: User
```

```yaml
entity: Payment
```

```yaml
relationship: User → Payment
verb: creates
cardinality: 1:N
required: true
```

Then recompile:

```bash
dotdog compile
```

## Unknown relationship source

You may see:

```text
✗ Unknown relationship source "User -> Payment" (target: "")
```

This often means the relationship syntax was not parsed as a source and target pair. Use the same relationship format shown in the docs and make sure both sides are real entities:

```yaml
relationship: User → Payment
```

Then run:

```bash
dotdog compile
```

## No .dag files found

You may see:

```text
No .dag files found. Run compile first.
```

Commands such as `dotdog tokens` and MCP usage need a compiled `.dag` graph. Build it from the project root:

```bash
dotdog compile
dotdog tokens
```

If you changed `.dog` files, compile again before starting `dotdog serve`.

## No index found

You may see:

```text
No index found. Run dotdog index first.
```

`dotdog search` reads a generated search index. Build the index, then repeat the search:

```bash
dotdog index
dotdog search "payment"
```

## Score dropped

`dotdog validate` reports a completeness score. If the score drops, compare the current output with the previous run and look for:

- deleted required files
- newly empty sections
- missing entity descriptions
- missing relationship or property details

Fix the reported gaps, then run:

```bash
dotdog validate
dotdog compile
```

Treat the score as a guardrail: it is usually better to add a small honest section than to leave a placeholder blank.
