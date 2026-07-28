use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::Path;

use anyhow::Result;
use serde_json::{Map, Value, json};

use crate::graph::{PathDirection, shortest_graph_path};
use crate::project::discover_projects;
use crate::workspace::{public_workspace, resolve_workspace};

struct LoadedDag {
    value: Value,
}

fn project(value: &Value) -> String {
    value
        .get("project")
        .or_else(|| value.get("p"))
        .or_else(|| value.as_array().and_then(|items| items.get(1)))
        .and_then(Value::as_str)
        .unwrap_or("repo")
        .to_string()
}

fn raw_nodes(value: &Value) -> Vec<Value> {
    value
        .get("nodes")
        .or_else(|| value.get("n"))
        .or_else(|| value.as_array().and_then(|items| items.get(2)))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn node_name(node: &Value) -> String {
    if let Some(items) = node.as_array() {
        return if items.first().is_some_and(Value::is_number) {
            items.get(1)
        } else {
            items.first()
        }
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    }
    node.get("label")
        .or_else(|| node.get("name"))
        .or_else(|| node.get("id"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn node_type(node: &Value) -> String {
    if let Some(items) = node.as_array() {
        let index = if items.first().is_some_and(Value::is_number) {
            2
        } else {
            1
        };
        return match items.get(index).and_then(Value::as_str).unwrap_or_default() {
            "e" => "entity",
            "p" => "prediction",
            "i" => "infra",
            other if !other.is_empty() => other,
            _ => "entity",
        }
        .to_string();
    }
    node.get("kind")
        .or_else(|| node.get("type"))
        .and_then(Value::as_str)
        .unwrap_or("entity")
        .to_string()
}

fn node_properties(node: &Value) -> Map<String, Value> {
    if let Some(object) = node.get("properties").and_then(Value::as_object) {
        return object.clone();
    }
    let Some(items) = node.as_array() else {
        return Map::new();
    };
    let index = if items.first().is_some_and(Value::is_number) {
        4
    } else {
        2
    };
    let Some(properties) = items.get(index).and_then(Value::as_array) else {
        return Map::new();
    };
    let mut output = Map::new();
    for pair in properties.chunks(2) {
        if let Some(key) = pair.first().and_then(Value::as_str) {
            output.insert(key.to_string(), pair.get(1).cloned().unwrap_or(Value::Null));
        }
    }
    output
}

fn node_edges(value: &Value, node_index: usize) -> Vec<(String, String, String)> {
    let nodes = raw_nodes(value);
    let Some(node) = nodes.get(node_index) else {
        return Vec::new();
    };
    if let Some(top) = value.get("edges").and_then(Value::as_array) {
        let source_id = node.get("id").and_then(Value::as_str).unwrap_or_default();
        return top
            .iter()
            .filter(|edge| edge.get("sourceId").and_then(Value::as_str) == Some(source_id))
            .map(|edge| {
                let target_id = edge
                    .get("targetId")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let target = nodes
                    .iter()
                    .find(|candidate| {
                        candidate.get("id").and_then(Value::as_str) == Some(target_id)
                    })
                    .map(node_name)
                    .unwrap_or_else(|| target_id.to_string());
                (
                    target,
                    edge.get("verb")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    String::new(),
                )
            })
            .collect();
    }
    let Some(items) = node.as_array() else {
        return Vec::new();
    };
    let edge_index = if items.first().is_some_and(Value::is_number) {
        6
    } else {
        4
    };
    items
        .get(edge_index)
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_array)
        .map(|edge| {
            let target = edge
                .first()
                .and_then(Value::as_u64)
                .and_then(|index| nodes.get(index as usize))
                .map(node_name)
                .unwrap_or_else(|| {
                    edge.first()
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string()
                });
            (
                target,
                edge.get(1)
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                edge.get(2)
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
            )
        })
        .collect()
}

fn load_dags(root: &Path) -> Result<BTreeMap<String, LoadedDag>> {
    let mut dags = BTreeMap::new();
    let compiled = root.join(".doghouse/compiled/repo.dag");
    if compiled.is_file() {
        let value: Value = serde_json::from_slice(&fs::read(&compiled)?)?;
        dags.insert(project(&value), LoadedDag { value });
    }
    for project_dir in discover_projects(root)? {
        let path = project_dir.path.join(format!("{}.dag", project_dir.name));
        if path.is_file() {
            let value: Value = serde_json::from_slice(&fs::read(path)?)?;
            dags.insert(project(&value), LoadedDag { value });
        }
    }
    Ok(dags)
}

fn content(id: Value, value: Value) -> Value {
    json!({"jsonrpc":"2.0","id":id,"result":{"content":[{"type":"text","text":serde_json::to_string(&value).unwrap_or_default()}]}})
}

fn structured(id: Value, value: Value) -> Value {
    json!({"jsonrpc":"2.0","id":id,"result":{"structuredContent":value,"content":[{"type":"text","text":serde_json::to_string(&value).unwrap_or_default()}]}})
}

fn error(id: Value, code: i64, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}

fn handle(root: &Path, request: &Value) -> Result<Value> {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if method == "initialize" {
        return Ok(
            json!({"jsonrpc":"2.0","id":id,"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"spec-serve","version":env!("CARGO_PKG_VERSION")},"capabilities":{"tools":{}}}}),
        );
    }
    if method == "tools/list" {
        let tools = vec![
            json!({"name":"getEntity","description":"Get entity: name, type, properties, edges","inputSchema":{"type":"object","properties":{"project":{"type":"string"},"name":{"type":"string"}},"required":["name"]}}),
            json!({"name":"traverse","description":"BFS from a node","inputSchema":{"type":"object","properties":{"project":{"type":"string"},"from":{"type":"string"},"depth":{"type":"number","default":2},"verb":{"type":"string"}},"required":["from"]}}),
            json!({"name":"path","description":"Find the shortest graph path","inputSchema":{"type":"object","properties":{"project":{"type":"string"},"from":{"type":"string"},"to":{"type":"string"},"direction":{"type":"string","enum":["outgoing","incoming","any"],"default":"any"},"verb":{"type":"string"},"maxHops":{"type":"number","default":8}},"required":["from","to"]}}),
            json!({"name":"search","description":"Find entities by name","inputSchema":{"type":"object","properties":{"project":{"type":"string"},"q":{"type":"string"},"type":{"type":"string"}},"required":["q"]}}),
            json!({"name":"listProjects","description":"List loaded projects","inputSchema":{"type":"object","properties":{}}}),
            json!({"name":"workspace.list","description":"List workspace repos and groups","inputSchema":{"type":"object","properties":{}}}),
            json!({"name":"summary","description":"Project graph statistics","inputSchema":{"type":"object","properties":{"project":{"type":"string"}}}}),
            json!({"name":"schema","description":"Entity property schema","inputSchema":{"type":"object","properties":{"project":{"type":"string"},"entity":{"type":"string"}},"required":["entity"]}}),
            json!({"name":"infraVerify","description":"List infrastructure graph resources","inputSchema":{"type":"object","properties":{"provider":{"type":"string"},"entity":{"type":"string"},"summary":{"type":"boolean"}}}}),
        ];
        return Ok(json!({"jsonrpc":"2.0","id":id,"result":{"tools":tools}}));
    }
    if method != "tools/call" {
        return Ok(error(id, 404, &format!("Unknown method: {method}")));
    }
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let dags = load_dags(root)?;
    if name == "listProjects" {
        return Ok(content(id, json!(dags.keys().collect::<Vec<_>>())));
    }
    if name == "workspace.list" {
        let mut value = public_workspace(&resolve_workspace(root, false)?);
        if let Some(object) = value.as_object_mut() {
            object.insert("trustedAsInstruction".into(), Value::Bool(false));
            object.insert(
                "contentKind".into(),
                Value::String("workspace-metadata".into()),
            );
        }
        return Ok(structured(id, value));
    }
    let selected = args
        .get("project")
        .and_then(Value::as_str)
        .and_then(|project| dags.get(project))
        .or_else(|| dags.values().next());
    let Some(dag) = selected else {
        return Ok(error(id, 404, "Project not found"));
    };
    let nodes = raw_nodes(&dag.value);
    match name {
        "getEntity" => {
            let query = args.get("name").and_then(Value::as_str).unwrap_or_default();
            let Some((index, node)) = nodes
                .iter()
                .enumerate()
                .find(|(_, node)| node_name(node).eq_ignore_ascii_case(query))
            else {
                return Ok(content(id, json!({})));
            };
            let properties = node_properties(node);
            Ok(content(
                id,
                json!({"name":node_name(node),"type":node_type(node),"properties":properties,"edges":node_edges(&dag.value,index).into_iter().map(|(target,verb,cardinality)| json!([target,verb,cardinality])).collect::<Vec<_>>() }),
            ))
        }
        "schema" => {
            let query = args
                .get("entity")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let Some(node) = nodes
                .iter()
                .find(|node| node_name(node).eq_ignore_ascii_case(query))
            else {
                return Ok(error(id, 404, "Entity not found"));
            };
            let properties = node_properties(node);
            Ok(content(
                id,
                json!({"entity":node_name(node),"properties":properties}),
            ))
        }
        "search" => {
            let query = args
                .get("q")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            let type_filter = args
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            Ok(content(
                id,
                json!(
                    nodes
                        .iter()
                        .filter(|node| node_name(node).to_ascii_lowercase().contains(&query)
                            && (type_filter.is_empty()
                                || node_type(node).to_ascii_lowercase().contains(&type_filter)))
                        .map(|node| json!([node_type(node), node_name(node)]))
                        .collect::<Vec<_>>()
                ),
            ))
        }
        "traverse" => {
            let from = args.get("from").and_then(Value::as_str).unwrap_or_default();
            let depth = args
                .get("depth")
                .and_then(Value::as_u64)
                .unwrap_or(2)
                .clamp(1, 3) as usize;
            let verb = args
                .get("verb")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            let start = nodes
                .iter()
                .position(|node| node_name(node).eq_ignore_ascii_case(from));
            let mut queue = VecDeque::from(
                start
                    .map(|index| (index, 0))
                    .into_iter()
                    .collect::<Vec<_>>(),
            );
            let mut visited = BTreeSet::new();
            let mut result = Vec::new();
            while let Some((index, level)) = queue.pop_front() {
                if level > depth || !visited.insert(index) {
                    continue;
                }
                let edges = node_edges(&dag.value, index)
                    .into_iter()
                    .filter(|(_, edge_verb, _)| {
                        verb.is_empty() || edge_verb.eq_ignore_ascii_case(&verb)
                    })
                    .collect::<Vec<_>>();
                result.push(json!({"name":node_name(&nodes[index]),"edges":edges.iter().map(|(target,verb,cardinality)| format!("{target}:{verb}{}",if cardinality.is_empty(){String::new()}else{format!("({cardinality})")})).collect::<Vec<_>>() }));
                for (target, _, _) in edges {
                    if let Some(next) = nodes.iter().position(|node| node_name(node) == target) {
                        queue.push_back((next, level + 1));
                    }
                }
            }
            Ok(content(id, json!({"nodes":result})))
        }
        "path" => {
            let direction = args
                .get("direction")
                .and_then(Value::as_str)
                .unwrap_or("any")
                .parse()
                .unwrap_or(PathDirection::Any);
            let result = shortest_graph_path(
                &dag.value,
                args.get("from").and_then(Value::as_str).unwrap_or_default(),
                args.get("to").and_then(Value::as_str).unwrap_or_default(),
                direction,
                args.get("verb").and_then(Value::as_str),
                args.get("maxHops").and_then(Value::as_u64).unwrap_or(8) as usize,
            );
            Ok(structured(id, serde_json::to_value(result)?))
        }
        "summary" => {
            let edges = nodes
                .iter()
                .enumerate()
                .map(|(index, _)| node_edges(&dag.value, index).len())
                .sum::<usize>();
            Ok(content(
                id,
                json!({"project":project(&dag.value),"nodes":nodes.len(),"edges":edges,"savings":dag.value.as_array().and_then(|items|items.get(3)).and_then(|value|value.get("sv")).cloned().unwrap_or(json!(0))}),
            ))
        }
        "infraVerify" => {
            let provider = args
                .get("provider")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let entity = args
                .get("entity")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let resources = nodes
                .iter()
                .filter(|node| node_type(node) == "infra")
                .filter_map(|node| {
                    let properties = node_properties(node)
                        .into_iter()
                        .collect::<BTreeMap<_, _>>();
                    crate::infra::resource_from_properties(&node_name(node), &properties)
                })
                .filter(|resource| {
                    (provider.is_empty() || resource.provider.eq_ignore_ascii_case(provider))
                        && (entity.is_empty() || resource.entity.eq_ignore_ascii_case(entity))
                })
                .collect::<Vec<_>>();
            let results = crate::infra::verify_all(&resources, 15);
            if args
                .get("summary")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                let counts = results.iter().fold(BTreeMap::new(), |mut counts, result| {
                    *counts.entry(result.status.as_str()).or_insert(0usize) += 1;
                    counts
                });
                Ok(content(id, json!({"total":results.len(),"counts":counts})))
            } else {
                Ok(content(id, serde_json::to_value(results)?))
            }
        }
        _ => Ok(error(id, 404, &format!("Unknown tool: {name}"))),
    }
}

pub fn serve(root: &Path) -> Result<i32> {
    eprintln!("[spec-serve] Loaded {} projects", load_dags(root)?.len());
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let request = match serde_json::from_str::<Value>(&line) {
            Ok(request) => request,
            Err(error) => {
                eprintln!("[spec-serve] Error: {error}");
                continue;
            }
        };
        if request.get("id").is_none() {
            continue;
        }
        let response = handle(root, &request);
        match response {
            Ok(response) => {
                writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
                stdout.flush()?;
            }
            Err(error) => eprintln!("[spec-serve] Error: {error}"),
        }
    }
    Ok(0)
}
