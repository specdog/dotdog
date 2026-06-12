# Adding dotdog to an existing project

Got a project already? No .dog files? Here's what to do.

## Quick start for existing projects

```bash
npm install -g dotdog
cd your-project
dotdog init your-project
```

This creates `specs/your-project/` with template .dog files. Nothing is overwritten.

## Fill in SPEC.dog

Open `specs/your-project/SPEC.dog` and fill in:

1. **Product** : what does this project do? One paragraph.
2. **Stack** : what tech do you use?
3. **User Stories** : 3-5 key things users can do.

That's enough to get started. 5 minutes.

## Then run

```bash
dotdog validate
dotdog analyze
```

The dog will tell you what's missing. Fill gaps. Repeat. Score goes up.

## For teams

- Commit .dog files alongside code. They're markdown : reviewers can read them.
- Run `dotdog validate` in CI. Block PRs with broken specs.
- Start `dotdog serve` for AI agents to query your specs.
- Compile .dag files for agent consumption.

## It doesn't have to be perfect

Start with SPEC.dog. Add data-model.dog when you have entities. Add plan.dog for roadmap. Grow the spec over time. The dog just checks what's there.
