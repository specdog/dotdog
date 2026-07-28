use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
struct VisualNode {
    id: String,
    label: String,
    kind: String,
}

#[derive(Debug, Clone, Serialize)]
struct VisualEdge {
    source: String,
    target: String,
    verb: String,
}

fn text(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn graph(value: &Value) -> (Vec<VisualNode>, Vec<VisualEdge>) {
    let raw = value
        .get("nodes")
        .or_else(|| value.get("n"))
        .or_else(|| value.as_array().and_then(|items| items.get(2)))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let nodes = raw
        .iter()
        .enumerate()
        .map(|(index, node)| {
            if let Some(items) = node.as_array() {
                let v2 = items.first().is_some_and(Value::is_number);
                let label = text(items.get(usize::from(v2))).if_empty(&index.to_string());
                let kind = if v2 {
                    text(items.get(2)).if_empty("entity")
                } else {
                    match text(items.get(1)).as_str() {
                        "e" => "entity".into(),
                        "p" => "prediction".into(),
                        "i" => "infra".into(),
                        other => other.to_string().if_empty("entity"),
                    }
                };
                VisualNode {
                    id: index.to_string(),
                    label,
                    kind,
                }
            } else {
                let id =
                    text(node.get("id").or_else(|| node.get("label"))).if_empty(&index.to_string());
                VisualNode {
                    label: text(
                        node.get("label")
                            .or_else(|| node.get("name"))
                            .or_else(|| node.get("id")),
                    )
                    .if_empty(&id),
                    kind: text(node.get("kind").or_else(|| node.get("type"))).if_empty("entity"),
                    id,
                }
            }
        })
        .collect::<Vec<_>>();
    let by_external_id = raw
        .iter()
        .enumerate()
        .filter_map(|(index, node)| {
            node.get("id")
                .and_then(Value::as_str)
                .map(|id| (id.to_string(), nodes[index].id.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    let mut edges = BTreeMap::<String, VisualEdge>::new();
    if let Some(top) = value.get("edges").and_then(Value::as_array) {
        for edge in top {
            let source = text(edge.get("sourceId").or_else(|| edge.get("source")));
            let target = text(edge.get("targetId").or_else(|| edge.get("target")));
            let source = by_external_id.get(&source).cloned().unwrap_or(source);
            let target = by_external_id.get(&target).cloned().unwrap_or(target);
            let verb = text(edge.get("verb").or_else(|| edge.get("type")));
            if !source.is_empty() && !target.is_empty() {
                edges.insert(
                    format!("{source}\0{target}\0{verb}"),
                    VisualEdge {
                        source,
                        target,
                        verb,
                    },
                );
            }
        }
    } else {
        for (index, node) in raw.iter().enumerate() {
            let Some(items) = node.as_array() else {
                continue;
            };
            let edge_index = if items.first().is_some_and(Value::is_number) {
                6
            } else {
                4
            };
            for edge in items
                .get(edge_index)
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_array)
            {
                let target = edge
                    .first()
                    .and_then(Value::as_u64)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| text(edge.first()));
                let verb = text(edge.get(1));
                edges.insert(
                    format!("{index}\0{target}\0{verb}"),
                    VisualEdge {
                        source: index.to_string(),
                        target,
                        verb,
                    },
                );
            }
        }
    }
    (nodes, edges.into_values().collect())
}

pub fn render_html(value: &Value, project: &str) -> String {
    let (nodes, edges) = graph(value);
    let kinds = nodes
        .iter()
        .map(|node| node.kind.clone())
        .collect::<BTreeSet<_>>();
    let data = serde_json::json!({"project":project,"nodes":nodes,"edges":edges,"kinds":kinds});
    let data = serde_json::to_string(&data)
        .unwrap_or_else(|_| "{}".into())
        .replace('<', "\\u003c");
    TEMPLATE
        .replace("__GRAPH_DATA__", &data)
        .replace("__PROJECT__", &escape(project))
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}
impl IfEmpty for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.into()
        } else {
            self
        }
    }
}

const TEMPLATE: &str = r##"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__PROJECT__ · Dotdog graph</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#121a2d;--line:#53627c;--text:#e7edf7;--muted:#93a4bf;--accent:#73e0b1}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 ui-sans-serif,system-ui,sans-serif;overflow:hidden}header{height:64px;display:flex;gap:18px;align-items:center;padding:10px 18px;background:rgba(18,26,45,.96);border-bottom:1px solid #26334c}h1{font-size:16px;margin:0;white-space:nowrap}input{width:min(360px,35vw);background:#0b1020;border:1px solid #34425d;border-radius:8px;padding:9px 12px;color:var(--text)}button{background:#24334f;color:var(--text);border:1px solid #40516f;border-radius:8px;padding:8px 11px;cursor:pointer}.stats{color:var(--muted);margin-left:auto}main{display:grid;grid-template-columns:1fr 280px;height:calc(100vh - 64px)}#canvas{width:100%;height:100%;touch-action:none}.edge{stroke:var(--line);stroke-width:1.5;fill:none;opacity:.65}.edge-label{fill:var(--muted);font-size:11px;text-anchor:middle}.node rect{stroke:#7788a6;stroke-width:1.3;rx:10;filter:drop-shadow(0 3px 5px #0008)}.node text{fill:#fff;text-anchor:middle;pointer-events:none}.node .kind{fill:#c4d0e4;font-size:10px}.node{cursor:pointer}.node.dim,.edge.dim,.edge-label.dim{opacity:.08}.node.focus rect{stroke:var(--accent);stroke-width:3}aside{background:var(--panel);border-left:1px solid #26334c;padding:18px;overflow:auto}aside h2{font-size:15px;margin-top:0}aside p{color:var(--muted);white-space:pre-line}.legend{display:flex;flex-wrap:wrap;gap:7px}.chip{padding:5px 8px;border-radius:999px;border:1px solid #40516f;font-size:11px}.hint{position:fixed;left:18px;bottom:14px;color:var(--muted);pointer-events:none}@media(max-width:760px){main{grid-template-columns:1fr}aside{display:none}.stats{display:none}}
</style></head><body>
<header><h1>__PROJECT__ · graph</h1><input id="search" type="search" placeholder="Find a node…" aria-label="Find a node"><button id="fit">Fit graph</button><span class="stats" id="stats"></span></header>
<main><svg id="canvas" role="img" aria-label="Interactive Dotdog graph"><defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0L10 4L0 8Z" fill="#53627c"/></marker></defs><g id="viewport"><g id="edges"></g><g id="labels"></g><g id="nodes"></g></g></svg><aside><h2 id="detail-title">Select a node</h2><p id="detail-copy">Click a node to highlight its direct connections.</p><div class="legend" id="legend"></div></aside></main><div class="hint">Drag to pan · scroll to zoom · click a node to trace connections</div>
<script>const data=__GRAPH_DATA__;const svg=document.querySelector('#canvas'),view=document.querySelector('#viewport'),nodesLayer=document.querySelector('#nodes'),edgesLayer=document.querySelector('#edges'),labelsLayer=document.querySelector('#labels');const W=190,H=58,gapX=270,gapY=92;const palette=['#315b85','#3f6f58','#75557f','#8a5b3c','#4f648f','#7a4e5c','#4d7275','#6a6638'];const kindColor=new Map(data.kinds.map((k,i)=>[k,palette[i%palette.length]]));const incoming=new Map(data.nodes.map(n=>[n.id,0]));data.edges.forEach(e=>incoming.set(e.target,(incoming.get(e.target)||0)+1));const level=new Map(data.nodes.filter(n=>(incoming.get(n.id)||0)===0).map(n=>[n.id,0]));for(let pass=0;pass<data.nodes.length;pass++)data.edges.forEach(e=>{if(level.has(e.source))level.set(e.target,Math.max(level.get(e.target)||0,level.get(e.source)+1))});data.nodes.forEach(n=>{if(!level.has(n.id))level.set(n.id,0)});const columns=new Map;data.nodes.forEach(n=>{const l=Math.min(level.get(n.id),8);if(!columns.has(l))columns.set(l,[]);columns.get(l).push(n)});const position=new Map;[...columns.entries()].sort((a,b)=>a[0]-b[0]).forEach(([l,list])=>list.sort((a,b)=>a.label.localeCompare(b.label)).forEach((n,i)=>position.set(n.id,{x:80+l*gapX,y:60+i*gapY})));const ns='http://www.w3.org/2000/svg';function el(name,attrs,parent){const x=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,v));parent.append(x);return x}data.edges.forEach((e,i)=>{const a=position.get(e.source),b=position.get(e.target);if(!a||!b)return;const x1=a.x+W,y1=a.y+H/2,x2=b.x,y2=b.y+H/2,curve=Math.max(45,(x2-x1)*.45);const path=el('path',{class:'edge','data-i':i,d:`M${x1} ${y1} C${x1+curve} ${y1},${x2-curve} ${y2},${x2} ${y2}`,'marker-end':'url(#arrow)'},edgesLayer);const label=el('text',{class:'edge-label','data-i':i,x:(x1+x2)/2,y:(y1+y2)/2-6},labelsLayer);label.textContent=e.verb});data.nodes.forEach(n=>{const p=position.get(n.id),g=el('g',{class:'node','data-id':n.id,transform:`translate(${p.x} ${p.y})`,tabindex:'0'},nodesLayer);el('rect',{width:W,height:H,fill:kindColor.get(n.kind)||palette[0]},g);const label=el('text',{x:W/2,y:24},g);label.textContent=n.label.length>25?n.label.slice(0,23)+'…':n.label;const kind=el('text',{class:'kind',x:W/2,y:43},g);kind.textContent=n.kind;g.addEventListener('click',()=>focus(n.id));g.addEventListener('keydown',e=>{if(e.key==='Enter')focus(n.id)})});document.querySelector('#stats').textContent=`${data.nodes.length} nodes · ${data.edges.length} connections`;const legend=document.querySelector('#legend');data.kinds.forEach(k=>{const chip=document.createElement('span');chip.className='chip';chip.style.background=`${kindColor.get(k)}55`;chip.textContent=k;legend.append(chip)});function focus(id){const connected=new Set([id]);data.edges.forEach(e=>{if(e.source===id)connected.add(e.target);if(e.target===id)connected.add(e.source)});document.querySelectorAll('.node').forEach(n=>{n.classList.toggle('dim',!connected.has(n.dataset.id));n.classList.toggle('focus',n.dataset.id===id)});data.edges.forEach((e,i)=>{const dim=e.source!==id&&e.target!==id;document.querySelector(`.edge[data-i="${i}"]`)?.classList.toggle('dim',dim);document.querySelector(`.edge-label[data-i="${i}"]`)?.classList.toggle('dim',dim)});const node=data.nodes.find(n=>n.id===id),out=data.edges.filter(e=>e.source===id),inc=data.edges.filter(e=>e.target===id),details=[...out.map(e=>`${e.verb} → ${data.nodes.find(n=>n.id===e.target)?.label||e.target}`),...inc.map(e=>`${data.nodes.find(n=>n.id===e.source)?.label||e.source} → ${e.verb}`)];document.querySelector('#detail-title').textContent=node.label;document.querySelector('#detail-copy').textContent=`${node.kind}\n${out.length} outgoing · ${inc.length} incoming\n\n${details.join('\n')||'No connections'}`};document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.node').forEach(n=>{const item=data.nodes.find(x=>x.id===n.dataset.id);n.classList.toggle('dim',q&&!`${item.label} ${item.kind}`.toLowerCase().includes(q))})});let scale=1,tx=0,ty=0,drag=false,last;function transform(){view.setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`)}svg.addEventListener('wheel',e=>{e.preventDefault();scale=Math.min(2.5,Math.max(.2,scale*(e.deltaY>0?.9:1.1)));transform()},{passive:false});svg.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;drag=true;last=[e.clientX,e.clientY];svg.setPointerCapture(e.pointerId)});svg.addEventListener('pointermove',e=>{if(!drag)return;tx+=e.clientX-last[0];ty+=e.clientY-last[1];last=[e.clientX,e.clientY];transform()});svg.addEventListener('pointerup',()=>drag=false);function fit(){const box=view.getBBox(),rect=svg.getBoundingClientRect();scale=Math.min((rect.width-80)/Math.max(box.width,1),(rect.height-80)/Math.max(box.height,1),1.3);tx=(rect.width-box.width*scale)/2-box.x*scale;ty=(rect.height-box.height*scale)/2-box.y*scale;transform()}document.querySelector('#fit').onclick=fit;requestAnimationFrame(fit);
</script></body></html>"##;

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::render_html;

    #[test]
    fn escapes_graph_data_and_project_title() {
        let html = render_html(
            &json!({
                "nodes": [{"id":"one","label":"</script><script>alert(1)</script>","kind":"entity"}],
                "edges": []
            }),
            "<unsafe>",
        );
        assert!(html.contains("&lt;unsafe&gt;"));
        assert!(!html.contains("</script><script>alert(1)</script>"));
        assert!(html.contains(r"\u003c/script>\u003cscript>alert(1)\u003c/script>"));
    }
}
