# JBrain Dotdog Lookup Plan

Status: implementation plan
Scope: map, compile, query, trace, and fast lookup
Goal: use Dotdog so agents do not reread every file when a compiled graph can answer first

## Core Loop

```text
intent -> .dog source -> compiled .dag graph -> query/trace -> correction -> better graph
```

Dotdog should be the compiler and lookup layer.

JBrain should remain the source project that proves the workflow.

## Current State

Working now:

- Dotdog validates `.dog` files.
- Dotdog compiles `.dog` files into `.dag` graphs.
- Dotdog source has a `map [dir]` command.
- The mapper can emit `repo-map.dog` and `repo.dag`.
- JBrain can be mapped by running the local source CLI.
- Dotdog itself can also be mapped by running the local source CLI.

Current gaps:

- Installed `dotdog` does not expose `map` yet.
- Generated repo maps are useful but shallow.
- JBrain atoms are not all first-class graph nodes yet.
- Query and trace need to work on the compiled graph as a normal user workflow.

## Phase 1: Ship `dotdog map`

Problem: `map` exists in source but not in the installed CLI.

Tasks:

- Add or fix the package build script.
- Ensure `dist/cli.js` includes the `map [dir]` command.
- Add a smoke test for `dotdog map .`.
- Confirm normal CLI usage works, not only source execution.

Acceptance:

```bash
npx dotdog map .
```

writes:

```text
specs/<project>/repo-map.dog
specs/<project>/repo.dag
```

## Phase 2: Compile Atoms as Nodes

Problem: important JBrain atoms live inside bank files, but they are not all compiled as direct graph nodes.

Tasks:

- Detect YAML blocks with `atom:`.
- Use `kind`, `claim`, `source`, `confidence`, and `links` fields.
- Emit one DAG node per atom.
- Emit edges from atom links.
- Preserve the source file path on each node.

Example input:

```yaml
atom: pattern.rebuild-the-primitive
kind: pattern
claim: Durable operating pattern.
source: reflection
confidence: high
links: [Project, Pattern]
```

Example graph result:

```text
pattern.rebuild-the-primitive [pattern]
pattern.rebuild-the-primitive --links_to--> Project
pattern.rebuild-the-primitive --links_to--> Pattern
```

Acceptance:

A query for `primitive` should find the atom node without opening the full bank file.

## Phase 3: Graph Query and Trace

Problem: lookup should start from the graph.

Commands:

```bash
dotdog query <dag> <term>
dotdog trace <dag> <node-id>
dotdog find-atom <dag> <kind-or-term>
```

Behavior:

- `query` returns node id, kind, confidence, source file, and short description.
- `trace` returns incoming edges, outgoing edges, neighbor nodes, and source file.
- `find-atom` filters atom-shaped nodes.

Acceptance:

```bash
dotdog query specs/jbrain/jbrain.dag primitive
```

finds the relevant pattern node.

```bash
dotdog trace specs/jbrain/jbrain.dag pattern.rebuild-the-primitive
```

shows related graph context.

## Phase 4: Improve Repo Map Classification

Problem: repo maps are useful but need better file typing.

Add classifications:

- `.dog` -> `spec`
- `.dag` -> `compiled_graph`
- `scripts/*.mjs` -> `script`
- `INDEX.dog` -> `navigation_index`
- `README.md` -> `human_entrypoint`
- `repo-map.dog` -> `generated_repo_map`
- `repo.dag` -> `generated_repo_graph`

Add relationships:

```text
spec --compiles_to--> compiled_graph
repo-map.dog --describes--> repository
repo.dag --models--> repository
INDEX.dog --orients--> repository
package.json --runs--> script
workflow --runs--> compile
```

Acceptance:

Mapping a repo should show what is source, what is generated, what is human-facing, and what is machine-facing.

## Phase 5: Human Map Output

Problem: `repo-map.dog` is graph-friendly, but humans need a plain orientation layer.

Add one output:

```text
specs/<project>/human-map.dog
```

It should answer:

- What is this repo?
- Where do I start?
- What files should I edit?
- What files are generated?
- What command checks the system?
- What command rebuilds the graph?

Acceptance:

A new human or agent can inspect the map before reading the full repo.

## Phase 6: JBrain Integration

After Dotdog supports the above, update JBrain.

Add scripts:

```json
{
  "jbrain:map": "dotdog map .",
  "jbrain:query": "dotdog query specs/jbrain/jbrain.dag",
  "jbrain:trace": "dotdog trace specs/jbrain/jbrain.dag",
  "jbrain:find": "dotdog find-atom specs/jbrain/jbrain.dag"
}
```

Then regenerate:

```bash
npm run jbrain:map
npm run compile:all
```

Acceptance:

Agents should query the DAG first and only read raw files when graph output is not enough.

## PR Order

1. CLI map release fix.
2. Atom nodes.
3. Query and trace commands.
4. Better repo classification.
5. Human map output.
6. JBrain integration.

## Design Rules

Stay lean.

Build lookup before UI.

Build graph before search sprawl.

Prefer source files that humans can edit.

Prefer compiled files that machines can query.

Do not overwrite hand-authored specs.

Do not turn every sentence into a node.

Make constraints inspectable and fixable.

## Done State

The system is working when this is true:

```text
A useful claim enters JBrain as an atom.
Dotdog compiles it into a node.
The agent finds it through query or trace.
The user can correct the source.
The graph recompiles into better lookup state.
```
