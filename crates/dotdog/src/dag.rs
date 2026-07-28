use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde::Serialize;
use serde_json::{Value, json};

use crate::grammar::BlockNode;
use crate::parser::parse;
use crate::project::{Project, discover_projects};

#[derive(Debug, Clone)]
struct CompiledNode {
    name: String,
    type_name: String,
    kind: String,
    description: String,
    properties: BTreeMap<String, String>,
    states: Vec<String>,
    confidence: f64,
    timeframe: String,
    trigger: String,
    measurement: String,
}

#[derive(Debug, Clone)]
struct CompiledEdge {
    source: String,
    target: String,
    verb: String,
    cardinality: String,
    required: bool,
}

#[derive(Debug, Clone)]
pub struct CompileResult {
    pub path: PathBuf,
    pub node_count: usize,
    pub edge_count: usize,
    pub file_count: usize,
    pub source_tokens: i64,
    pub dag_tokens: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditResult {
    pub path: String,
    #[serde(rename = "nodeCount")]
    pub node_count: usize,
    #[serde(rename = "edgeCount")]
    pub edge_count: usize,
    pub kinds: BTreeMap<String, usize>,
    #[serde(rename = "missingKinds")]
    pub missing_kinds: Vec<String>,
    pub ok: bool,
}

pub fn compile(root: &Path, v2: bool) -> Result<Vec<PathBuf>> {
    Ok(compile_projects(root, v2, None)?
        .into_iter()
        .map(|result| result.path)
        .collect())
}

pub fn compile_projects(
    root: &Path,
    v2: bool,
    output: Option<&Path>,
) -> Result<Vec<CompileResult>> {
    let projects = discover_projects(root)?;
    let mut results = Vec::new();
    for (index, project) in projects.iter().enumerate() {
        let output = if let Some(path) = output {
            if projects.len() > 1 && index > 0 {
                bail!("--output can only be used when compiling one project");
            }
            path.to_path_buf()
        } else {
            project.path.join(format!("{}.dag", project.name))
        };
        results.push(compile_project(project, v2, &output)?);
    }
    Ok(results)
}

fn compile_project(project: &Project, v2: bool, output: &Path) -> Result<CompileResult> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut source_bytes = 0usize;
    let mut content_bytes = 0usize;

    for file in &project.dog_files {
        let source = fs::read_to_string(file)
            .with_context(|| format!("failed to read {}", file.display()))?;
        let bytes = source.len();
        source_bytes += bytes;
        if bytes >= 100 {
            content_bytes += bytes;
        }
        let document = parse(&source);
        for block in document
            .sections
            .iter()
            .flat_map(|section| section.blocks.iter())
        {
            match block {
                BlockNode::Entity {
                    name,
                    description,
                    entity_type,
                    properties,
                    states,
                    ..
                } => {
                    let defaults = properties
                        .iter()
                        .filter_map(|(key, property)| {
                            property.default.as_ref().map(|value| {
                                let value = match value {
                                    Value::String(value) => value.clone(),
                                    _ => value.to_string(),
                                };
                                (key.clone(), value)
                            })
                        })
                        .collect();
                    nodes.push(CompiledNode {
                        name: name.clone(),
                        type_name: entity_type.clone(),
                        kind: "entity".to_string(),
                        description: description.clone(),
                        properties: defaults,
                        states: states.clone(),
                        confidence: 0.0,
                        timeframe: String::new(),
                        trigger: String::new(),
                        measurement: String::new(),
                    });
                }
                BlockNode::Event { name, trigger, .. } => nodes.push(CompiledNode {
                    name: name.clone(),
                    type_name: "event".to_string(),
                    kind: "event".to_string(),
                    description: String::new(),
                    properties: BTreeMap::new(),
                    states: Vec::new(),
                    confidence: 0.0,
                    timeframe: String::new(),
                    trigger: trigger.clone(),
                    measurement: String::new(),
                }),
                BlockNode::Endpoint { name, .. } => nodes.push(CompiledNode {
                    name: name.clone(),
                    type_name: "endpoint".to_string(),
                    kind: "entity".to_string(),
                    description: String::new(),
                    properties: BTreeMap::new(),
                    states: Vec::new(),
                    confidence: 0.0,
                    timeframe: String::new(),
                    trigger: String::new(),
                    measurement: String::new(),
                }),
                BlockNode::Prediction {
                    statement,
                    description,
                    confidence,
                    timeframe,
                    trigger,
                    measurement,
                    ..
                } => nodes.push(CompiledNode {
                    name: statement.clone(),
                    type_name: "prediction".to_string(),
                    kind: "prediction".to_string(),
                    description: description.clone(),
                    properties: BTreeMap::new(),
                    states: Vec::new(),
                    confidence: *confidence,
                    timeframe: timeframe.clone(),
                    trigger: trigger.clone(),
                    measurement: measurement.clone(),
                }),
                BlockNode::Relationship {
                    source,
                    target,
                    verb,
                    cardinality,
                    required,
                    ..
                } => edges.push(CompiledEdge {
                    source: source.clone(),
                    target: target.clone(),
                    verb: verb.clone(),
                    cardinality: cardinality.clone(),
                    required: *required,
                }),
                _ => {}
            }
        }
    }

    let names: HashSet<_> = nodes.iter().map(|node| node.name.as_str()).collect();
    for edge in &edges {
        if !names.contains(edge.source.as_str()) {
            bail!(
                "Unknown relationship source \"{}\" (target: \"{}\")",
                edge.source,
                edge.target
            );
        }
        if !names.contains(edge.target.as_str()) {
            bail!(
                "Unknown relationship target \"{}\" (source: \"{}\")",
                edge.target,
                edge.source
            );
        }
    }

    let ids: HashMap<_, _> = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (node.name.clone(), index))
        .collect();
    let mut v2_nodes = Vec::new();
    for (index, node) in nodes.iter().enumerate() {
        let properties = node
            .properties
            .iter()
            .flat_map(|(key, value)| [Value::String(key.clone()), Value::String(value.clone())])
            .collect::<Vec<_>>();
        let mut outgoing = Vec::new();
        let mut seen = HashSet::new();
        for edge in edges.iter().filter(|edge| edge.source == node.name) {
            let target = ids[&edge.target];
            let key = format!("{index}:{target}:{}", edge.verb);
            if !seen.insert(key) {
                continue;
            }
            let mut serialized = vec![json!(target), json!(edge.verb)];
            if !edge.cardinality.is_empty() {
                serialized.push(json!(edge.cardinality));
            }
            if edge.required {
                serialized.push(json!(1));
            }
            outgoing.push(Value::Array(serialized));
        }
        let mut serialized = vec![
            json!(index),
            json!(node.name),
            json!(node.type_name),
            json!(node.description),
            Value::Array(properties),
            json!(node.states),
            Value::Array(outgoing),
        ];
        if node.kind == "prediction" {
            let mut forecast = Vec::new();
            if node.confidence != 0.0 {
                forecast.push(json!(node.confidence));
            }
            if !node.timeframe.is_empty() {
                forecast.push(json!(node.timeframe));
            }
            if !node.trigger.is_empty() {
                forecast.push(json!(node.trigger));
            }
            if !node.measurement.is_empty() {
                forecast.push(json!(node.measurement));
            }
            if !forecast.is_empty() {
                serialized.push(Value::Array(forecast));
            }
        }
        v2_nodes.push(Value::Array(serialized));
    }

    let source_tokens = round_tokens(source_bytes);
    let content_tokens = round_tokens(content_bytes);
    let v2_payload = json!({ "v": 2, "p": project.name, "n": v2_nodes });
    let dag_tokens = round_tokens(serde_json::to_vec(&v2_payload)?.len());
    let savings = percentage_savings(source_tokens, dag_tokens);
    let content_savings = percentage_savings(content_tokens, dag_tokens);
    let token_meta = json!({
        "m": "chars/4",
        "st": source_tokens,
        "ct": content_tokens,
        "dt": dag_tokens,
        "sv": savings,
        "cs": content_savings,
        "saved": source_tokens - dag_tokens
    });

    let output_value = if v2 {
        json!({
            "v": 2,
            "p": project.name,
            "n": v2_payload["n"],
            "tk": token_meta
        })
    } else {
        let v3_nodes = v2_payload["n"]
            .as_array()
            .expect("v2 nodes are arrays")
            .iter()
            .enumerate()
            .map(|(index, raw)| {
                let raw = raw.as_array().expect("v2 node is array");
                let node = &nodes[index];
                let type_code = if node.kind == "prediction" {
                    "p"
                } else if node.type_name == "infra" {
                    "i"
                } else {
                    "e"
                };
                let properties = raw[4]
                    .as_array()
                    .filter(|values| !values.is_empty())
                    .map(|values| Value::Array(values.clone()))
                    .unwrap_or(Value::Null);
                let states = raw[5]
                    .as_array()
                    .filter(|values| !values.is_empty())
                    .map(|values| Value::Array(values.clone()))
                    .unwrap_or(Value::Null);
                let outgoing = raw[6]
                    .as_array()
                    .filter(|values| !values.is_empty())
                    .map(|values| Value::Array(values.clone()))
                    .unwrap_or(Value::Null);
                let mut compact = vec![
                    json!(node.name),
                    json!(type_code),
                    properties,
                    states,
                    outgoing,
                ];
                if node.kind == "prediction" && raw.len() > 7 {
                    compact.push(raw[7].clone());
                }
                Value::Array(compact)
            })
            .collect::<Vec<_>>();
        Value::Array(vec![
            json!(3),
            json!(project.name),
            Value::Array(v3_nodes),
            token_meta.clone(),
            token_meta,
        ])
    };

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        output,
        format!("{}\n", serde_json::to_string_pretty(&output_value)?),
    )?;

    Ok(CompileResult {
        path: output.to_path_buf(),
        node_count: nodes.len(),
        edge_count: edges.len(),
        file_count: project.dog_files.len(),
        source_tokens,
        dag_tokens,
    })
}

pub fn audit_file(path: &Path, required_kinds: &[String]) -> Result<AuditResult> {
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let nodes = raw_nodes(&dag);
    let mut kinds = BTreeMap::new();
    let mut edge_count = 0usize;
    for node in &nodes {
        *kinds.entry(node_kind(node)).or_insert(0) += 1;
        edge_count += node_edges(node).len();
    }
    if let Some(edges) = dag.get("edges").and_then(Value::as_array) {
        edge_count = edges.len();
    } else if let Some(edges) = dag.get("e").and_then(Value::as_array) {
        edge_count = edges.len();
    }
    let missing_kinds = required_kinds
        .iter()
        .filter(|kind| !kinds.contains_key(kind.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    Ok(AuditResult {
        path: path.display().to_string(),
        node_count: nodes.len(),
        edge_count,
        kinds,
        ok: !nodes.is_empty() && missing_kinds.is_empty(),
        missing_kinds,
    })
}

pub fn visualize_file(path: &Path) -> Result<String> {
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let nodes = raw_nodes(&dag);
    let mut output = String::from("```mermaid\ngraph LR\n");
    for (index, node) in nodes.iter().enumerate() {
        let name = node_name(node, index);
        if !name.is_empty() {
            output.push_str(&format!("    {}[{}]\n", slug(&name), name));
        }
    }
    let mut seen = HashSet::new();
    for (index, node) in nodes.iter().enumerate() {
        let source_name = node_name(node, index);
        for edge in node_edges(node) {
            let Some(edge) = edge.as_array() else {
                continue;
            };
            let Some(target_index) = edge.first().and_then(Value::as_u64) else {
                continue;
            };
            let target_name = nodes
                .get(target_index as usize)
                .map(|node| node_name(node, target_index as usize))
                .unwrap_or_else(|| target_index.to_string());
            let verb = edge.get(1).and_then(Value::as_str).unwrap_or_default();
            let key = format!("{}:{}:{}", source_name, target_name, verb);
            if seen.insert(key) {
                output.push_str(&format!(
                    "    {} -->|{}| {}\n",
                    slug(&source_name),
                    verb,
                    slug(&target_name)
                ));
            }
        }
    }
    if let Some(edges) = dag
        .get("edges")
        .or_else(|| dag.get("e"))
        .and_then(Value::as_array)
    {
        for edge in edges {
            let source = edge
                .get("source")
                .or_else(|| edge.get("s"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let target = edge
                .get("target")
                .or_else(|| edge.get("t"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let verb = edge
                .get("verb")
                .or_else(|| edge.get("v"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let key = format!("{source}:{target}:{verb}");
            if !source.is_empty() && !target.is_empty() && seen.insert(key) {
                output.push_str(&format!(
                    "    {} -->|{}| {}\n",
                    slug(source),
                    verb,
                    slug(target)
                ));
            }
        }
    }
    output.push_str("```\n");
    Ok(output)
}

pub fn query_file(path: &Path, term: &str) -> Result<Vec<Value>> {
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let needle = term.to_ascii_lowercase();
    let mut matches = Vec::new();
    for (index, node) in raw_nodes(&dag).into_iter().enumerate() {
        let name = node_name(&node, index);
        if name.to_ascii_lowercase().contains(&needle)
            || node.to_string().to_ascii_lowercase().contains(&needle)
        {
            matches.push(node);
        }
    }
    Ok(matches)
}

pub fn shortest_path(
    path: &Path,
    from_query: &str,
    to_query: &str,
    direction: &str,
    max_hops: usize,
) -> Result<Value> {
    let dag: Value = serde_json::from_slice(&fs::read(path)?)?;
    let nodes = dag
        .get("nodes")
        .and_then(Value::as_array)
        .context("path requires a repository-world DAG with nodes")?;
    let edges = dag
        .get("edges")
        .and_then(Value::as_array)
        .context("path requires a repository-world DAG with edges")?;
    let from = resolve_endpoint(nodes, from_query);
    let to = resolve_endpoint(nodes, to_query);
    let (from_index, from_candidates) = from;
    let (to_index, to_candidates) = to;
    if from_index.is_none() || to_index.is_none() {
        let candidates = if from_index.is_none() {
            from_candidates
        } else {
            to_candidates
        };
        return Ok(json!({
            "ok": false,
            "direction": direction,
            "hops": 0,
            "nodes": [],
            "edges": [],
            "error": if candidates.is_empty() { "endpoint_not_found" } else { "ambiguous_endpoint" },
            "candidates": candidates
        }));
    }
    let from_index = from_index.expect("checked");
    let to_index = to_index.expect("checked");
    let id_to_index = nodes
        .iter()
        .enumerate()
        .filter_map(|(index, node)| {
            node.get("id")
                .and_then(Value::as_str)
                .map(|id| (id.to_string(), index))
        })
        .collect::<HashMap<_, _>>();
    let mut adjacency: HashMap<usize, Vec<(usize, usize)>> = HashMap::new();
    for (edge_index, edge) in edges.iter().enumerate() {
        let Some(source) = edge.get("sourceId").and_then(Value::as_str) else {
            continue;
        };
        let Some(target) = edge.get("targetId").and_then(Value::as_str) else {
            continue;
        };
        let (Some(&source_index), Some(&target_index)) =
            (id_to_index.get(source), id_to_index.get(target))
        else {
            continue;
        };
        if direction == "outgoing" || direction == "any" {
            adjacency
                .entry(source_index)
                .or_default()
                .push((target_index, edge_index));
        }
        if direction == "incoming" || direction == "any" {
            adjacency
                .entry(target_index)
                .or_default()
                .push((source_index, edge_index));
        }
    }

    let mut queue = VecDeque::from([(from_index, vec![from_index], Vec::<usize>::new())]);
    let mut visited = HashSet::from([from_index]);
    while let Some((current, node_path, edge_path)) = queue.pop_front() {
        if current == to_index {
            let path_nodes = node_path
                .iter()
                .map(|index| nodes[*index].clone())
                .collect::<Vec<_>>();
            let path_edges = edge_path
                .iter()
                .map(|index| edges[*index].clone())
                .collect::<Vec<_>>();
            return Ok(json!({
                "ok": true,
                "direction": direction,
                "hops": path_edges.len(),
                "from": endpoint_info(from_query, &nodes[from_index]),
                "to": endpoint_info(to_query, &nodes[to_index]),
                "nodes": path_nodes,
                "edges": path_edges
            }));
        }
        if edge_path.len() >= max_hops.clamp(1, 12) {
            continue;
        }
        for (next, edge) in adjacency.get(&current).cloned().unwrap_or_default() {
            if visited.insert(next) {
                let mut next_nodes = node_path.clone();
                next_nodes.push(next);
                let mut next_edges = edge_path.clone();
                next_edges.push(edge);
                queue.push_back((next, next_nodes, next_edges));
            }
        }
    }

    Ok(json!({
        "ok": false,
        "direction": direction,
        "hops": 0,
        "from": endpoint_info(from_query, &nodes[from_index]),
        "to": endpoint_info(to_query, &nodes[to_index]),
        "nodes": [],
        "edges": [],
        "error": "no_path"
    }))
}

pub fn find_dag_files(root: &Path) -> Result<Vec<PathBuf>> {
    let mut files = discover_projects(root)?
        .into_iter()
        .map(|project| project.path.join(format!("{}.dag", project.name)))
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    files.sort();
    Ok(files)
}

fn raw_nodes(dag: &Value) -> Vec<Value> {
    if let Some(array) = dag.as_array() {
        return array
            .get(2)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
    }
    dag.get("n")
        .or_else(|| dag.get("nodes"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn node_name(node: &Value, index: usize) -> String {
    if let Some(array) = node.as_array() {
        if array.first().and_then(Value::as_u64).is_some() {
            return array
                .get(1)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
        }
        return array
            .first()
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
    }
    node.get("i")
        .or_else(|| node.get("id"))
        .or_else(|| node.get("label"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| index.to_string())
}

fn node_kind(node: &Value) -> String {
    if let Some(array) = node.as_array() {
        if array.first().and_then(Value::as_u64).is_some() {
            return array
                .get(2)
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
        }
        return match array.get(1).and_then(Value::as_str).unwrap_or_default() {
            "p" => "prediction".to_string(),
            "i" => "infra".to_string(),
            "e" => "entity".to_string(),
            other if !other.is_empty() => other.to_string(),
            _ => "unknown".to_string(),
        };
    }
    node.get("kind")
        .or_else(|| node.get("type"))
        .or_else(|| node.get("t"))
        .or_else(|| node.get("g"))
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string()
}

fn node_edges(node: &Value) -> Vec<Value> {
    if let Some(array) = node.as_array() {
        if array.first().and_then(Value::as_u64).is_some() {
            return array
                .get(6)
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
        }
        return array
            .get(4)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
    }
    node.get("edges")
        .or_else(|| node.get("es"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn resolve_endpoint(nodes: &[Value], query: &str) -> (Option<usize>, Vec<String>) {
    let needle = query.trim().to_ascii_lowercase();
    let exact = nodes
        .iter()
        .enumerate()
        .filter(|(_, node)| {
            node.get("id")
                .and_then(Value::as_str)
                .is_some_and(|id| id.eq_ignore_ascii_case(&needle))
                || node
                    .get("label")
                    .and_then(Value::as_str)
                    .is_some_and(|label| label.eq_ignore_ascii_case(&needle))
        })
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if exact.len() == 1 {
        return (exact.first().copied(), Vec::new());
    }
    if exact.len() > 1 {
        return (None, candidate_labels(nodes, &exact));
    }
    let terms = needle
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();
    let full = nodes
        .iter()
        .enumerate()
        .filter(|(_, node)| {
            let words = node
                .get("label")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase()
                .split(|character: char| !character.is_ascii_alphanumeric())
                .filter(|term| !term.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>();
            terms
                .iter()
                .all(|term| words.iter().any(|word| word == term))
        })
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if full.len() == 1 {
        return (full.first().copied(), Vec::new());
    }
    if full.len() > 1 {
        return (None, candidate_labels(nodes, &full));
    }
    let partial = nodes
        .iter()
        .enumerate()
        .filter(|(_, node)| {
            node.get("label")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase()
                .contains(&needle)
        })
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if partial.len() == 1 {
        return (partial.first().copied(), Vec::new());
    }
    (None, candidate_labels(nodes, &partial))
}

fn candidate_labels(nodes: &[Value], indexes: &[usize]) -> Vec<String> {
    let mut labels = indexes
        .iter()
        .filter_map(|index| nodes[*index].get("label").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    labels.sort();
    labels
}

fn endpoint_info(query: &str, node: &Value) -> Value {
    json!({
        "query": query,
        "id": node.get("id").and_then(Value::as_str).unwrap_or_default(),
        "label": node.get("label").and_then(Value::as_str).unwrap_or_default()
    })
}

fn round_tokens(bytes: usize) -> i64 {
    ((bytes as f64) / 4.0).round() as i64
}

fn percentage_savings(source: i64, compiled: i64) -> f64 {
    if source <= 0 {
        return 0.0;
    }
    (((1.0 - compiled as f64 / source as f64) * 1000.0).round()) / 10.0
}

fn slug(value: &str) -> String {
    let mut slug = value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("_")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    if slug
        .chars()
        .next()
        .is_some_and(|character| !character.is_ascii_alphabetic())
    {
        slug.insert_str(0, "n_");
    }
    slug
}
