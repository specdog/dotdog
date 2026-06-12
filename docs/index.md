# 🐕 dotdog

> **Feed the dog. Ship with specs.** Write .dog specs. Dog checks them. AI agents fetch them.

<div id="dog-widget" style="text-align:center;margin-bottom:16px;user-select:none">
  <svg id="dog-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" style="width:140px;height:112px">
    <line x1="20" y1="145" x2="180" y2="145" stroke="#e5e7eb" stroke-width="2"/>
    <rect id="leg-bl" x="52" y="110" width="10" height="30" rx="4" fill="#d97706"/>
    <rect id="leg-br" x="92" y="110" width="10" height="30" rx="4" fill="#d97706"/>
    <rect id="leg-fl" x="112" y="110" width="10" height="30" rx="4" fill="#d97706"/>
    <rect id="leg-fr" x="138" y="110" width="10" height="30" rx="4" fill="#d97706"/>
    <ellipse cx="110" cy="95" rx="45" ry="25" fill="#f59e0b"/>
    <path id="tail" d="M65 90 Q50 75 55 65" fill="none" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="78" cy="38" rx="10" ry="14" fill="#d97706" transform="rotate(-10 78 38)"/>
    <ellipse cx="142" cy="38" rx="10" ry="14" fill="#d97706" transform="rotate(10 142 38)"/>
    <circle class="dog-face" cx="110" cy="65" r="28" fill="#f59e0b"/>
    <circle cx="100" cy="60" r="4" fill="#1a1a2e"/><circle cx="122" cy="60" r="4" fill="#1a1a2e"/>
    <circle cx="101" cy="59" r="1.5" fill="#fff"/><circle cx="123" cy="59" r="1.5" fill="#fff"/>
    <ellipse cx="111" cy="70" rx="5" ry="4" fill="#1a1a2e"/>
    <path d="M104 76 Q111 82 118 76" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
    <ellipse id="tongue" cx="111" cy="82" rx="4" ry="5" fill="#ef4444" opacity="0"/>
    <g id="bone" opacity="0"><rect x="24" y="138" width="20" height="6" rx="3" fill="#fef3c7"/><circle cx="24" cy="141" r="4" fill="#fef3c7"/><circle cx="44" cy="141" r="4" fill="#fef3c7"/></g>
    <circle id="ball" cx="170" cy="135" r="7" fill="#ef4444" opacity="0"/>
  </svg>
  <div style="width:140px;height:4px;background:#e5e7eb;border-radius:2px;margin:4px auto"><div id="hunger-fill" style="height:100%;background:#f59e0b;border-radius:2px;width:100%"></div></div>
  <div id="dog-status" style="font-size:.75em;color:#9ca3af;min-height:18px">🐕 Spec is happy. Dog fed.</div>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
    <button onclick="feed()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🦴 Feed</button>
    <button onclick="pet()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">✋ Pet</button>
    <button onclick="fetchBall()" style="padding:4px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:.78em;cursor:pointer;font-family:inherit">🎾 Fetch</button>
  </div>
</div>
<script>
let hunger=100;
const svg=document.getElementById('dog-svg'),f=document.getElementById('hunger-fill'),st=document.getElementById('dog-status');
const tail=document.getElementById('tail'),bone=document.getElementById('bone'),ball=document.getElementById('ball'),tongue=document.getElementById('tongue');
function upd(){f.style.width=hunger+'%';if(hunger>60)st.innerHTML='🐕 Spec is happy. Dog fed.';else if(hunger>25)st.innerHTML='🐕 Spec is hungry... feed the dog?';else st.innerHTML='😢 Spec is starving! Run dotdog validate!';}
function feed(){hunger=Math.min(100,hunger+30);bone.setAttribute('opacity','1');st.innerHTML='🦴 Nom! Spec is fed. Ship with specs!';setTimeout(()=>bone.setAttribute('opacity','0'),1500);upd();}
function pet(){hunger=Math.min(100,hunger+10);tongue.setAttribute('opacity','1');tail.setAttribute('d','M65 90 Q45 75 50 60');st.innerHTML='✋ Good Spec. *wags tail*';setTimeout(()=>{tail.setAttribute('d','M65 90 Q50 75 55 65');tongue.setAttribute('opacity','0');},800);upd();}
function fetchBall(){if(hunger<20){st.innerHTML='😢 Spec is too hungry. Feed first!';return;}hunger=Math.max(0,hunger-15);ball.setAttribute('opacity','1');ball.setAttribute('cx','170');let x=170;const a=setInterval(()=>{x-=8;ball.setAttribute('cx',x);if(x<=20){clearInterval(a);ball.setAttribute('opacity','0');}},30);st.innerHTML='🎾 Fetch! dotdog compile...';upd();}
svg.addEventListener('click',feed);setInterval(()=>{hunger=Math.max(0,hunger-2);upd()},8000);
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;if(e.key==='v')feed();if(e.key==='c')fetchBall();if(e.key==='p')pet();});
upd();
</script>

## 🦴 Install

```bash
npm install -g dotdog
```

[Adding dotdog to an existing project?](adopting.md)

## What it does

Describe your app in plain English. dotdog finds what you forgot and fills in the blanks.

```
$ dotdog init my-app
$ dotdog validate

  my-app — 7 .dog files, 100% complete

$ dotdog analyze

  my-app — 7 files | 100% complete
    SPEC.dog — 5 sections, 1.0KB
    data-model.dog — 3 sections, 1.6KB (5 entities, 6 rels)
  No gaps found.

$ dotdog compile
  ✓ my-app.dag — 3 nodes, 3 edges
  12,400 → 1,860 tokens (85% savings)

$ dotdog serve
  MCP server running — AI agents query your specs with zero hallucination
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
| `dotdog init` | Scaffold a new project |
| `dotdog list` | List all projects |

## Format

- `.dog` — Human-written spec (markdown + YAML entities). Free forever.
- `.dag` — Machine-compiled graph (JSON). Token-efficient for AI agents.

## For AI Agents

`dotdog serve` exposes your specs via MCP. Six tools:

| Tool | Description |
|------|-------------|
| `getEntity` | Exact entity with properties, states, edges |
| `traverse` | BFS subgraph from any node |
| `search` | Find entities by name or type |
| `schema` | Property definitions only — agent-optimized |
| `summary` | Node/edge/file counts |
| `listProjects` | All project names |

## Links

- [GitHub](https://github.com/specdog/dotdog)
- [npm](https://www.npmjs.com/package/dotdog)
- [Format Spec (.dog)](https://github.com/specdog/dotdog/blob/main/spec/format-spec.dog)
- [Format Spec (.dag)](https://github.com/specdog/dotdog/blob/main/spec/format-spec-dag.dog)
- [AGENTS.md](https://github.com/specdog/dotdog/blob/main/AGENTS.md)
- [llms.txt](https://github.com/specdog/dotdog/blob/main/llms.txt)

---

dotdog@0.3.0 · [MIT](https://github.com/specdog/dotdog/blob/main/LICENSE)
