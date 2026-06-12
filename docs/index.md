# 🐕 dotdog

> **Feed the dog. Ship with specs.** — Structured, AI-queryable software specifications. Fetch your specs from prose.

<div id="dog" style="display:inline-block;cursor:pointer;margin-bottom:12px;user-select:none" title="Feed the dog">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="width:100px;height:100px;transition:transform .15s">
    <ellipse cx="28" cy="28" rx="13" ry="17" fill="#d97706" transform="rotate(-15 28 28)"/>
    <ellipse cx="92" cy="28" rx="13" ry="17" fill="#d97706" transform="rotate(15 92 28)"/>
    <circle class="dog-face" cx="60" cy="63" r="32" fill="#f59e0b"/>
    <circle cx="46" cy="56" r="5" fill="#1a1a2e"/><circle cx="74" cy="56" r="5" fill="#1a1a2e"/>
    <circle cx="48" cy="54" r="2" fill="#fff"/><circle cx="76" cy="54" r="2" fill="#fff"/>
    <ellipse cx="60" cy="70" rx="7" ry="5" fill="#1a1a2e"/>
    <path d="M52 78 Q60 86 68 78" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
    <ellipse class="tongue" cx="60" cy="84" rx="5" ry="6" fill="#ef4444" style="opacity:0;transition:opacity .2s"/>
  </svg>
</div>
<div style="width:100px;height:4px;background:#e5e7eb;border-radius:2px;margin:0 auto 4px"><div id="hunger-fill" style="height:100%;background:#f59e0b;border-radius:2px;width:100%"></div></div>
<div id="dog-status" style="font-size:.75em;color:#9ca3af;margin-bottom:8px">🐕 Good dog. Dog fed.</div>
<div style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;flex-wrap:wrap">
  <button onclick="feed()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🦴 Feed</button>
  <button onclick="pet()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">✋ Pet</button>
  <button onclick="throwBone()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🎾 Fetch</button>
</div>
<script>
let hunger=100;
const d=document.getElementById('dog'),f=document.getElementById('hunger-fill'),st=document.getElementById('dog-status');
function upd(){f.style.width=hunger+'%';if(hunger>60)st.innerHTML='🐕 Good dog. Dog fed.';else if(hunger>25)st.innerHTML='🐕 Hungry... feed the dog?';else st.innerHTML='😢 Dog hungry! Run dotdog validate!';}
function feed(){hunger=Math.min(100,hunger+30);st.innerHTML='🍖 Nom! Dog fed. Ship with specs!';upd();}
function pet(){hunger=Math.min(100,hunger+10);st.innerHTML='✋ Good doggo. Wags tail.';d.querySelector('svg').style.transform='rotate(-5deg)';setTimeout(()=>d.querySelector('svg').style.transform='rotate(5deg)',150);setTimeout(()=>d.querySelector('svg').style.transform='',300);upd();}
function throwBone(){if(hunger<20){st.innerHTML='😢 Too hungry. Feed the dog first!';return;}hunger=Math.max(0,hunger-15);d.querySelector('svg').style.transform='translateX(30px)';st.innerHTML='🎾 Fetch! dotdog compile...';setTimeout(()=>d.querySelector('svg').style.transform='',400);upd();}
d.addEventListener('click',feed);setInterval(()=>{hunger=Math.max(0,hunger-2);upd()},8000);upd();
</script>

## 🦴 Install

```bash
npm install -g dotdog
```

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks. Compiles your specs into a queryable graph that AI agents can traverse with zero hallucination.

```
$ dotdog init my-app
$ dotdog validate
  my-app — 7 .dog files, 100% complete

$ dotdog analyze
  my-app — 7 files | 100% complete
    5 entities, 6 relationships
  No gaps found. Good dog.

$ dotdog compile
  ✓ my-app.dag — 3 nodes, 3 edges
  12,400 → 1,860 tokens (85% savings)
  sha256: abc123... verified

$ dotdog serve
  MCP server running — AI agents fetch your specs
```

## Commands

| Command | |
|---------|-----|
| `dotdog validate` | Score spec completeness (0-100%) |
| `dotdog analyze` | Deep analysis — gaps, entities, suggestions |
| `dotdog parse` | Parse a .dog file into sections |
| `dotdog compile` | Compile .dog to .dag with integrity + token savings |
| `dotdog generate` | Generate missing spec files from SPEC.dog |
| `dotdog serve` | MCP server — AI agents query specs over stdio |
| `dotdog staleness` | Detect drift between spec and reality |
| `dotdog visualize` | Output Mermaid graph from .dag |
| `dotdog simulate` | Run a simulation scenario |
| `dotdog init` | Scaffold a new spec genome project |
| `dotdog list` | List all projects |

## 🐾 File Formats

### `.dog` — Human-Written Spec Genome

Markdown prose + YAML structured blocks. Define entities, relationships, events, and copy. Free forever.

### `.dag` — Machine-Compiled Graph

JSON graph with typed nodes, edges, integrity hash, and provable token savings. Built for AI agents — query via MCP with zero hallucination. Each `.dag` file proves exactly how much compute it saves vs reading raw specs. That's a good dog.

## 🤖 For AI Agents

`dotdog serve` exposes your specs via MCP. Six tools:

| Tool | |
|------|-----|
| `getEntity` | Exact entity with properties, states, edges |
| `traverse` | BFS subgraph from any starting node |
| `search` | Find entities by name or type — fetch what you need |
| `schema` | Property definitions only — zero prose |
| `summary` | Node/edge/file counts + token savings |
| `listProjects` | All project names |

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec (.dog)](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
- [Format Spec (.dag)](https://github.com/specdog/dotdog/blob/main/spec/format-spec-dag.dog)
- [AGENTS.md](https://github.com/specdog/dotdog/blob/main/AGENTS.md)
- [llms.txt](https://github.com/specdog/dotdog/blob/main/llms.txt)
