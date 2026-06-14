# 🐕 dotdog

> **Feed the dog. Ship with specs.** Write .dog specs. Dog checks them. AI agents fetch them.

<div id="dog-widget" style="text-align:center;margin-bottom:16px;user-select:none">
  <svg id="dog-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="width:100px;height:100px">
    <ellipse cx="28" cy="28" rx="13" ry="17" fill="#d97706" transform="rotate(-15 28 28)"/>
    <ellipse cx="92" cy="28" rx="13" ry="17" fill="#d97706" transform="rotate(15 92 28)"/>
    <circle class="dog-face" cx="60" cy="63" r="32" fill="#f59e0b"/>
    <circle cx="46" cy="56" r="5" fill="#1a1a2e"/><circle cx="74" cy="56" r="5" fill="#1a1a2e"/>
    <circle cx="48" cy="54" r="2" fill="#fff"/><circle cx="76" cy="54" r="2" fill="#fff"/>
    <ellipse cx="60" cy="70" rx="7" ry="5" fill="#1a1a2e"/>
    <path d="M52 78 Q60 86 68 78" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
    <ellipse id="tongue" cx="60" cy="84" rx="5" ry="6" fill="#ef4444" opacity="0" style="transition:opacity .2s"/>
    <!-- bone in mouth -->
    <g id="bone" opacity="0">
      <path d="M44 80 Q44 70 55 76 L65 76 Q76 70 76 80 Q76 90 65 86 L55 86 Q44 90 44 80 Z" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
    </g>
  </svg>
  <div id="dog-status" style="font-size:.75em;color:#9ca3af;min-height:18px;margin:4px 0">🐕 Spec</div>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
    <button onclick="feed()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🦴 Feed</button>
    <button onclick="pet()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">✋ Pet</button>
    <button onclick="fetchBall()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🎾 Fetch</button>
  </div>
</div>
<script>
const svg=document.getElementById('dog-svg'),st=document.getElementById('dog-status');
const bone=document.getElementById('bone'),tongue=document.getElementById('tongue');
function feed(){bone.setAttribute('opacity','1');st.innerHTML='🦴 Dog fed. Ship with specs!';setTimeout(()=>bone.setAttribute('opacity','0'),1500);}
function pet(){tongue.setAttribute('opacity','1');svg.style.transform='rotate(-5deg)';st.innerHTML='✋ Good dog.';setTimeout(()=>{svg.style.transform='';tongue.setAttribute('opacity','0');},800);}
function fetchBall(){svg.style.transform='translateX(20px)';st.innerHTML='🎾 Fetch!';setTimeout(()=>svg.style.transform='',400);}
svg.addEventListener('click',feed);
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;if(e.key==='v')feed();if(e.key==='c')fetchBall();if(e.key==='p')pet();});
</script>

## 🦴 Getting Started

```bash
# npm
npm install -g dotdog

# or Homebrew
brew tap specdog/dotdog
brew install dotdog

dotdog init my-project --minimal    # just SPEC.dog + data-model.dog
dotdog validate                     # score your spec
dotdog compile                      # build .dag graph
dotdog tokens                       # see real byte savings
dotdog serve                        # expose to AI agents via MCP
```

[Adding dotdog to an existing project?](adopting.md)

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks.

```
$ dotdog init my-app
$ dotdog validate

  my-app : 7 .dog files, 100% complete

$ dotdog analyze

  my-app : 7 files | 100% complete
    SPEC.dog : 5 sections, 1.0KB
    data-model.dog : 3 sections, 1.6KB (5 entities, 6 rels)
  No gaps found.

$ dotdog compile
  ✓ my-app.dag : 3 nodes, 3 edges
  12,400 → 1,860 tokens (85% savings) → real savings: 88.9% smaller

$ dotdog serve
  MCP server running : AI agents query your specs with zero hallucination
```

## Commands

| Command | Description |
|---------|-------------|
| `dotdog validate` | Score spec completeness (0-100%) |
| `dotdog analyze` | Deep analysis: gaps, entity quality, suggestions |
| `dotdog parse` | Parse a .dog file into sections |
| `dotdog compile` | Compile .dog to .dag graph (JSON) |
| `dotdog generate` | Generate missing spec files from SPEC.dog |
| `dotdog serve` | MCP server for AI agents over stdio |
| `dotdog staleness` | Detect drift between spec and reality |
| `dotdog visualize` | Output Mermaid graph from .dag |
| `dotdog simulate` | Run a simulation scenario |
| `dotdog tokens` | Real byte savings (not estimates) |
| `dotdog init` | Scaffold a new project (`--minimal` for 2 files) |
| `dotdog list` | List all projects |

## Format

- `.dog` : Human-written spec (markdown + YAML entities). Free forever.
- `.dag` : Machine-compiled graph (JSON). Token-efficient for AI agents.

## MCP Server

`dotdog serve` runs an MCP server over stdio. AI agents query compiled .dag spec graphs without hallucination.

### Setup

Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "dotdog": {
      "command": "npx",
      "args": ["-y", "dotdog", "serve"]
    }
  }
}
```

Run `dotdog compile` first to generate .dag files.

### Tools

| Tool | Description |
|------|-------------|
| `getEntity` | Full entity: properties, states, lifecycle, connected edges |
| `traverse` | BFS subgraph from a starting node |
| `search` | Find entities by name or type |
| `schema` | Property schema only: names, types, required |
| `summary` | Node count, edge count, version, token savings |
| `listProjects` | All project names with compiled .dag files |

### Example

```
Agent: listProjects()
→ ["spec-platform"]

Agent: getEntity("spec-platform", "Compile")  
→ { id: "Compile", type: "entity", lifecycle: ["running → completed"], edges: […] }

Agent: summary("spec-platform")
→ { project: "spec-platform", nodes: 11, edges: 5, savings: 91% }
```

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec (.dog)](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
- [Format Spec (.dag)](https://github.com/specdog/dotdog/blob/main/spec/format-spec-dag.dog)
- [AGENTS.md](https://github.com/specdog/dotdog/blob/main/AGENTS.md)
- [llms.txt](https://github.com/specdog/dotdog/blob/main/llms.txt)

---

dotdog@0.3.3 · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE)
