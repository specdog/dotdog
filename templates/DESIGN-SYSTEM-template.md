# DESIGN-SYSTEM-TEMPLATE

> Tokens → primitives → components → patterns. Carbon. Apple. Material. They all start here.

## Architecture

```
LAYER 0: TOKENS (single source → style-dictionary → all platforms)
LAYER 1: PRIMITIVES (atoms — button, text field, avatar)
LAYER 2: COMPONENTS (molecules — card, bubble, list item)
LAYER 3: PATTERNS (organisms — nav bar, feed, composer)
LAYER 4: SCREENS (templates — login, main, settings)
```

## Layer 0: Tokens

Single source of truth. `design-tokens.json`.

| Category | Tokens |
|----------|--------|
| color | bg, fg, accent, semantic, border — light + dark mode |
| typography | fontFamily, fontSize, fontWeight |
| spacing | scale (0.25rem → 8rem) |
| radius | sm, DEFAULT, md, lg, pill |
| shadow | card, card-hover, elevated |
| motion | duration, easing |

**Output targets:** CSS vars, Tailwind, Compose, SwiftUI

## Layer 1: Primitives

Atomic elements. Each primitive has anatomy, variants, states, tokens.

### [Primitive Name]
- **Anatomy:** [parts]
- **Variants:** [types, sizes]
- **States:** default, hover, active, disabled, loading, error
- **Tokens:** [which tokens it consumes]
- **Code:** [component path]

### [Primitive Name]
- **Anatomy:** [parts]
- **Variants:** [types, sizes]
- **States:** default, hover, active, disabled, focus, error
- **Tokens:** [which tokens it consumes]
- **Code:** [component path]

## Layer 2: Components

[How primitives compose into reusable components.]

## Layer 3: Patterns

[How components arrange into recurring layouts.]

## Layer 4: Screens

[Full screen compositions.]
