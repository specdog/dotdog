---
layout: default
title: "FAQ"
description: "Frequently asked questions about dotdog."
---




## What is a .dog file?

A `.dog` file is a human-written spec combining Markdown prose with structured YAML blocks. It defines entities, relationships, events, screens, user stories, constraints, and predictions — everything needed to describe software completely.

## What is a .dag file?

A `.dag` file is a machine-compiled positional graph generated from `.dog` files. It is 94pct smaller than the source and optimized for LLM consumption. AI agents query it via MCP with zero hallucination risk.

## Do I need to use all spec files?

No. Start with `SPEC.dog` and `data-model.dog` using `dotdog init --minimal`. Add `constitution.dog`, `COPY.dog`, `plan.dog`, and others as your project grows.

## Which AI agents support dotdog?

Any MCP-compatible agent: Claude Desktop, Cursor, GitHub Copilot, Codex, and others. Configure your agent with the MCP server endpoint and it can query your specs.

## Is dotdog open source?

Yes. MIT licensed. Free forever.

## Can I use dotdog without AI agents?

Yes. `dotdog validate` and `dotdog compile` work standalone. The MCP server is optional — use it when you want AI agents to query your specs.

## How does dotdog compare to OpenAPI?

OpenAPI describes APIs. dotdog describes entire products — screens, states, user stories, data models, constraints, predictions. dotdog covers what OpenAPI cannot: the full product spec.

## How does token savings work?

The `.dag` format uses positional arrays instead of named keys, drops redundant fields, and strips empty values. An 48KB `.dog` source compiles to a 700-byte `.dag` graph — 94pct token savings for LLM context windows.
