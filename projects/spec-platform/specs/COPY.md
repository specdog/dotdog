# Spec Platform — Copy

> Every string the user sees in the CLI. No placeholders. Every state.

---

## CLI — spec validate

| Element | Context | Copy |
|---------|---------|------|
| Header | always | `Spec Platform — Validator` |
| No directory | no specs/ or projects/ found | `No projects/ or specs/ directory found.` |
| No directory hint | after error | `Run: spec init <project>` |
| No projects | directory exists, empty | `No projects found.` |
| Project header | per project | `{project_name}` |
| Divider | per project | `────────────────────────────────────────` |
| Pass icon | check passed | `✓` (green) |
| Warn icon | check warning | `⚠` (yellow) |
| Fail icon | check failed | `✗` (red) |
| Pass message | file exists | `{file} — exists` |
| Pass message | sections found | `{N} sections ({M} top-level). Good for LLM chunking.` |
| Pass message | entities found | `{N} entity definitions ({M} unique)` |
| Pass message | principles found | `{N} principles defined` |
| Warn message | file missing | `{file} — missing` |
| Warn message | no user stories | `no user stories found` |
| Warn message | no screens | `no screen mockups (ASCII art)` |
| Warn message | no description | `{N}/{M} entities missing description — can't be embedded for semantic search` |
| Warn message | chunk too large | `Section "{name}" is {size} chars (limit: 50,000). LLMs may truncate. Split into sub-sections.` |
| Score line | always | `Score: {N}% | {P} pass | {W} warn | {F} fail` |
| All clear | no failures | `All required files present.` |
| Errors found | failures > 0 | `{N} error(s). Fix before shipping.` |

## CLI — spec list

| Element | Context | Copy |
|---------|---------|------|
| Header | directory found | `{dir}/` |
| No projects | nothing found | `No projects found.` |
| No projects hint | after message | `Run: spec init <project>` |
| Project line | per project | `{project_name} — {N} spec files` |
| File line | per file | `{filename}` (gray) |

## CLI — spec init

| Element | Context | Copy |
|---------|---------|------|
| Success check | per file created | `✓ {filename}` (green) |
| Already exists | project exists | `Project "{name}" already exists.` |
| Done header | after creation | `Project "{name}" initialized.` |
| Path | after creation | `{path}/` |
| Next step | after creation | `Next: fill in SPEC.md, then run 'spec validate'` |

## CLI — spec simulate

| Element | Context | Copy |
|---------|---------|------|
| Header | always | `Simulation: {scenario} (project: {project})` |
| Placeholder | not implemented | `Simulation engine coming in 0.2.0.` |
| Placeholder hint | after message | `Reads SPEC.md scenarios, walks through steps, checks pre/postconditions.` |

## CLI — Global

| Element | Context | Copy |
|---------|---------|------|
| Version flag | `spec --version` | `0.1.0` |
| Help header | `spec --help` | `Spec platform CLI — manage spec genomes` |
| Command description | validate | `Validate specs in a directory` |
| Command description | init | `Initialize a new spec genome project` |
| Command description | list | `List all projects in specs directory` |
| Command description | simulate | `Run a simulation scenario` |

## MCP Server

| Element | Context | Copy |
|---------|---------|------|
| Startup | server ready | `Spec MCP Server running on stdio` |
| Specs dir | on startup | `Specs directory: {path}` |
| Projects | on startup | `Projects: {list}` or `none` |
| Not found | getSpec fails | `File not found: {project}/{file}` |
| Not found | getPRD fails | `SPEC.md not found for project: {project}` |
| Not found | getDataModel fails | `data-model.md not found for project: {project}` |
| Not found | getCopy fails | `COPY.md not found for project: {project}` |
| Not found | getDesignSystem fails | `DESIGN-SYSTEM.md not found for project: {project}` |
| Not found | getConstitution fails | `constitution.md not found for project: {project}` |

## MCP Tool Descriptions

| Tool | Description |
|------|-------------|
| listProjects | List all available projects in the spec platform |
| listSpecs | List all spec files in a project |
| getSpec | Get the full content of a spec file |
| searchSpecs | Search across all spec files in a project |
| getPRD | Get the product requirements document (SPEC.md) for a project |
| getDataModel | Get the data model spec for a project |
| getCopy | Get every UI string for a project |
| getDesignSystem | Get the design system spec for a project |
| getConstitution | Get the immutable rules for a project |
