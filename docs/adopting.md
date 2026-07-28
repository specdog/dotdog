---
layout: default
title: "Adding dotdog to an existing project"
description: "A practical adoption guide for adding dotdog specs, validation, compilation, and MCP access to an existing codebase."
---




# Adding dotdog to an existing project

Already have a product, app, or package? Add dotdog next to the codebase so the spec can grow with the implementation.

This guide uses an existing support portal as the example. Replace `support-portal` with your project name.

## 1. Map the repository you already have

Run this from the repository root:

```bash
dotdog map
dotdog compile
dotdog visualize .doghouse/compiled/repo.dag --format html --save
```

This creates an observed graph under `.doghouse/`. Open the generated HTML to inspect files and connections before describing the change you want.

## 2. Initialize specs from the project root

Run `dotdog init` in the root of the existing repository:

```bash
cd support-portal
dotdog init support-portal
```

This creates `specs/support-portal/` with the starter files dotdog expects:

```text
specs/support-portal/
  SPEC.dog
  constitution.dog
  data-model.dog
  plan.dog
  COPY.dog
  INDEX.dog
```

The command writes inside `specs/support-portal/`. It does not rewrite your application source files. If that spec directory already exists, choose a new branch and review the existing files before running init again.

## 3. Fill in SPEC.dog with screens and user stories

Open `specs/support-portal/SPEC.dog` and replace the stub with enough product context for a reviewer or AI agent to understand the current app.

Start with:

- one paragraph explaining what the project does
- the main screens or flows users see
- user stories with acceptance criteria

Example:

```markdown
# Support Portal

## Product

A web app where customers open support tickets and agents triage, assign, and resolve them.

## What the User Sees

### Screen: Ticket Inbox

+------------------------------------------+
| Ticket Inbox                       [New] |
|------------------------------------------|
| P1  Login fails                  Open    |
| P2  Billing question             Waiting |
| P3  Export request               Closed  |
+------------------------------------------+

## User Stories

| ID | Story | Priority | Acceptance |
|----|-------|----------|------------|
| US-01 | Customer creates a ticket | P0 | Ticket appears in the inbox with status Open |
| US-02 | Agent assigns a ticket | P0 | Assigned agent is stored and visible on the ticket |
| US-03 | Agent closes a ticket | P1 | Closed tickets leave the active inbox |
```

Keep the first pass small. Add enough detail to validate the existing product, then expand as gaps appear.

## 4. Define entities in data-model.dog

Open `specs/support-portal/data-model.dog` and describe the main objects your code already uses. Add properties, states, and relationships that match the implementation.

Example:

````markdown
# Data Model

## Entities

### Entity: Ticket

A customer support request that moves through the agent workflow.

```yaml
entity: Ticket
type: entity
properties:
  id:
    type: string
    required: true
  subject:
    type: string
    required: true
  priority:
    type: enum
    required: true
states: [open, waiting, closed]
lifecycle: open -> waiting -> closed
```

### Entity: Agent

A team member who owns and resolves support tickets.

```yaml
entity: Agent
type: entity
properties:
  id:
    type: string
    required: true
  name:
    type: string
    required: true
states: [active, inactive]
lifecycle: active -> inactive
```

### Relationship: Agent -> Ticket

An agent can own many tickets, and each active ticket should have one owner.

```yaml
relationship: Agent -> Ticket
verb: owns
cardinality: 1:N
required: true
```
````

Use the same names that appear in code, database tables, API payloads, or domain classes. That keeps later `search`, `schema`, and `getEntity` calls useful.

## 5. Validate and fix gaps

Run validation from the repository root:

```bash
dotdog validate
```

If dotdog reports missing required files, empty entities, or missing descriptions, fix those first. Then run the deeper analyzer:

```bash
dotdog analyze
```

Treat critical gaps as blockers before you ask another person or AI agent to rely on the specs. Optional gaps can become follow-up tasks in `plan.dog`.

## 6. Compile and check savings

Compile the `.dog` files into the compact graph format:

```bash
dotdog compile
```

The output is written beside the source specs:

```text
specs/support-portal/support-portal.dag
```

Check the compiled graph savings:

```bash
dotdog tokens
```

Look for a summary like:

```text
support-portal
  6 .dog files: 12400 bytes
  .dag payload: 740 bytes (94% savings, graph only)
```

Large savings mean an AI agent can load the structured graph instead of re-reading every prose file.

## 7. Serve the graph and verify MCP tools

Start the MCP server after compiling:

```bash
dotdog serve
```

The server reads compiled `.dag` files from `projects/`, `specs/`, or the current directory. In your MCP client, verify these calls work:

```text
listProjects()
summary("support-portal")
search(project: "support-portal", q: "ticket")
getEntity(project: "support-portal", name: "Ticket")
schema(project: "support-portal", entity: "Ticket")
traverse(project: "support-portal", from: "Ticket", depth: 1)
```

If `listProjects` is empty, run `dotdog compile` again from the project root and restart `dotdog serve`.

## Team adoption checklist

- Commit `.dog` source files with the code they describe.
- Run `dotdog validate` in CI so specs do not silently rot.
- Run `dotdog compile` before MCP usage so agents read the latest graph.
- Re-run `dotdog map` when repository structure changes and `dotdog drift` after observations.
- Review `SPEC.dog` and `data-model.dog` in the same PR as behavior changes.
- Add missing screens, entities, and flows as follow-up tasks in `plan.dog`.

Start with the smallest useful spec. The goal is not perfect documentation on day one. The goal is a living contract that code reviewers and AI agents can trust.
