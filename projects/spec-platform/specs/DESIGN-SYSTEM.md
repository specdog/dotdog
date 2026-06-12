# Spec Platform — Design System

> Terminal-first. Every visual element defined as tokens. Dark theme.

## Architecture

```
LAYER 0: TOKENS (single source — used by CLI, MCP, future dashboard)
LAYER 1: PRIMITIVES (status icons, dividers, headers)
LAYER 2: COMPONENTS (check lines, score blocks, project cards)
LAYER 3: PATTERNS (validation report, list view, init output)
LAYER 4: SCREENS (full CLI output layouts)
```

## Layer 0: Tokens

### Color — Terminal (ANSI via chalk)

| Token | Value | Usage |
|-------|-------|-------|
| green | chalk.green | Pass checks, success states, score numbers |
| yellow | chalk.yellow | Warnings, missing files, caution states |
| red | chalk.red | Failures, errors, blocking issues |
| cyan | chalk.cyan | Project names, file names, active elements |
| gray | chalk.gray | Hints, secondary text, file paths |
| bold | chalk.bold | Headers, project names, score line |

### Color — Future Dashboard (CSS)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| bg-primary | #FFFFFF | #0D1117 | Page background |
| bg-secondary | #F6F8FA | #161B22 | Card background |
| bg-tertiary | #EBEDF0 | #21262D | Input background |
| fg-primary | #1F2328 | #E6EDF3 | Primary text |
| fg-secondary | #656D76 | #8B949E | Secondary text |
| fg-muted | #8B949E | #484F58 | Muted text |
| accent-green | #1F883D | #3FB950 | Pass, success, score |
| accent-yellow | #9A6700 | #D29922 | Warnings, caution |
| accent-red | #CF222E | #F85149 | Errors, blocking |
| accent-blue | #0969DA | #58A6FF | Links, active |
| border | #D0D7DE | #30363D | Card borders, dividers |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| font-mono | SF Mono, JetBrains Mono, monospace | CLI output, code blocks |
| font-sans | -apple-system, SF Pro, Inter, sans-serif | Dashboard |
| size-xs | 12px / 0.75rem | Hints, secondary |
| size-sm | 14px / 0.875rem | Body |
| size-md | 16px / 1rem | Default |
| size-lg | 20px / 1.25rem | Headers |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| space-0 | 0 | Edge-to-edge |
| space-1 | 4px / 0.25rem | Tight |
| space-2 | 8px / 0.5rem | Default gap |
| space-3 | 16px / 1rem | Section gap |
| space-4 | 24px / 1.5rem | Block gap |
| space-5 | 40px / 2.5rem | Page margin |

### Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-none | 0 | Terminal (no rounding) |
| radius-sm | 4px | Dashboard cards, buttons |
| radius-md | 8px | Dashboard modals, inputs |
| radius-pill | 9999px | Badges, tags |

### Icons (ASCII for CLI)

| Token | Icon | Usage |
|-------|------|-------|
| icon-pass | ✓ | Pass check |
| icon-warn | ⚠ | Warning check |
| icon-fail | ✗ | Fail check |
| icon-arrow | → | Relationship, direction |
| icon-divider | ─ | Section divider |

## Layer 1: Primitives

### Status Icon

- **Anatomy:** Single character + color
- **Variants:** pass (✓ green), warn (⚠ yellow), fail (✗ red)
- **States:** only one state — static
- **Tokens:** green, yellow, red
- **Code:** `chalk.green('✓')`

### Section Divider

- **Anatomy:** 40 repeated `─` characters
- **Variants:** fixed width (40 chars)
- **States:** static
- **Tokens:** none (plain)
- **Code:** `'─'.repeat(40)`

### Indented Line

- **Anatomy:** 2 spaces + icon + space + text
- **Variants:** label width fixed at 22 chars (padded)
- **States:** pass, warn, fail
- **Tokens:** green, yellow, red, gray
- **Code:** `` `${icon} ${file.padEnd(22)} ${message}` ``

## Layer 2: Components

### Check Line

```
  ✓ SPEC.md                exists
  ⚠ COPY.md                missing
  ✗ constitution.md        missing — required
```

- **Anatomy:** Indented Line with status icon, padded filename, message
- **Source:** validate.ts `icon + file.padEnd(22) + message`

### Score Block

```
  Score: 69% | 9 pass | 4 warn | 0 fail
```

- **Anatomy:** Centered line with score + counts
- **Tokens:** bold, green (pass count), yellow (warn count), red (fail count)
- **Source:** validate.ts score calculation

### Project Header

```
  spec-platform
  ────────────────────────────────────────
```

- **Anatomy:** Bold project name + divider line
- **Tokens:** bold, cyan
- **Source:** validate.ts project iteration

### Init Success

```
  ✓ INDEX.md
  ✓ SPEC.md
  ✓ constitution.md
  ✓ data-model.md
  ✓ plan.md
  ✓ COPY.md
  ✓ tasks.md
  ✓ tasks/AGENTS.md

Project "demo" initialized.

  /Users/.../specs/demo/specs/
  Next: fill in SPEC.md, then run 'spec validate'
```

- **Anatomy:** File list + header + path + hint
- **Tokens:** green for checks, bold for header, gray for hint

## Layer 3: Patterns

### Validation Report Pattern

```
Spec Platform — Validator

  {project}
  ────────────────────────────────────────
  {check lines...}

  Score: {N}% | {P} pass | {W} warn | {F} fail

All required files present.
```

### List View Pattern

```
projects/
  spec-platform — 4 spec files
    constitution.md
    data-model.md
    SPEC.md
```

## Layer 4: Screens

### validate output (full)

```
Spec Platform — Validator


  spec-platform
  ────────────────────────────────────────
  ✓ SPEC.md                exists
  ✓ constitution.md        exists
  ✓ data-model.md          exists
  ⚠ COPY.md                missing
  ⚠ DESIGN-SYSTEM.md       missing
  ⚠ plan.md                missing
  ⚠ INDEX.md               missing
  ✓ constitution.md        4 sections (3 top-level). Good for LLM chunking.
  ✓ constitution.md        7 principles defined
  ✓ data-model.md          5 entity definitions (5 unique)
  ✓ SPEC.md                12 sections (7 top-level). Good for LLM chunking.

  Score: 69% | 9 pass | 4 warn | 0 fail

All required files present.
```
