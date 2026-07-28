use std::collections::{HashMap, HashSet, VecDeque};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PathDirection {
    Outgoing,
    Incoming,
    #[default]
    Any,
}

impl std::str::FromStr for PathDirection {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_ascii_lowercase().as_str() {
            "outgoing" => Ok(Self::Outgoing),
            "incoming" => Ok(Self::Incoming),
            "any" => Ok(Self::Any),
            _ => Err("direction must be outgoing, incoming, or any".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub verb: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EndpointInfo {
    pub query: String,
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphPathResult {
    pub ok: bool,
    pub direction: PathDirection,
    pub hops: usize,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<EndpointInfo>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<EndpointInfo>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidates: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
struct NormalizedGraph {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
}

fn compact_kind(code: &Value) -> String {
    match code.as_str().unwrap_or_default() {
        "p" => "prediction",
        "i" => "infra",
        "e" => "entity",
        other if !other.is_empty() => other,
        _ => "entity",
    }
    .to_string()
}

fn value_string(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Number(value)) => value.to_string(),
        Some(Value::Bool(value)) => value.to_string(),
        Some(Value::Null) | None => String::new(),
        Some(value) => value.to_string(),
    }
}

fn raw_nodes(dag: &Value) -> Vec<Value> {
    dag.get("nodes")
        .or_else(|| dag.get("n"))
        .or_else(|| dag.as_array().and_then(|items| items.get(2)))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn normalize_graph(dag: &Value) -> NormalizedGraph {
    let raw = raw_nodes(dag);
    let is_v3 = dag.is_array();
    let nodes: Vec<GraphNode> = raw
        .iter()
        .enumerate()
        .map(|(index, node)| {
            if let Some(items) = node.as_array() {
                let v2 = items.first().is_some_and(Value::is_number);
                let id = if v2 {
                    value_string(items.first())
                } else {
                    value_string(items.first()).if_empty(&index.to_string())
                };
                let label = if v2 {
                    value_string(items.get(1)).if_empty(&id)
                } else {
                    id.clone()
                };
                let kind = if v2 {
                    value_string(items.get(2)).if_empty("entity")
                } else {
                    compact_kind(items.get(1).unwrap_or(&Value::Null))
                };
                GraphNode {
                    id,
                    label,
                    kind: Some(kind),
                    confidence: Some("certain".into()),
                    origin: Some(
                        [("type".into(), Value::String("compiled".into()))]
                            .into_iter()
                            .collect(),
                    ),
                }
            } else {
                let id = value_string(
                    node.get("id")
                        .or_else(|| node.get("i"))
                        .or_else(|| node.get("label")),
                )
                .if_empty(&index.to_string());
                GraphNode {
                    label: value_string(
                        node.get("label")
                            .or_else(|| node.get("l"))
                            .or_else(|| node.get("id"))
                            .or_else(|| node.get("i")),
                    )
                    .if_empty(&id),
                    kind: Some(
                        value_string(
                            node.get("kind")
                                .or_else(|| node.get("g"))
                                .or_else(|| node.get("type"))
                                .or_else(|| node.get("t")),
                        )
                        .if_empty("entity"),
                    ),
                    confidence: node
                        .get("confidence")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    origin: node.get("origin").and_then(Value::as_object).cloned(),
                    id,
                }
            }
        })
        .collect();
    let by_index: HashMap<usize, String> = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (index, node.id.clone()))
        .collect();
    let by_name: HashMap<String, String> = nodes
        .iter()
        .map(|node| (node.label.to_ascii_lowercase(), node.id.clone()))
        .collect();
    let mut edges = Vec::new();

    let mut add_edge =
        |source: String, target_value: &Value, verb: String, extra: Option<&Value>| {
            let target_ref = target_value
                .as_u64()
                .and_then(|index| by_index.get(&(index as usize)).cloned())
                .unwrap_or_else(|| value_string(Some(target_value)));
            let target = by_name
                .get(&target_ref.to_ascii_lowercase())
                .cloned()
                .unwrap_or(target_ref);
            if source.is_empty() || target.is_empty() || verb.is_empty() {
                return;
            }
            let id = extra
                .and_then(|value| value.get("id"))
                .map(|value| value_string(Some(value)))
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| format!("{source}:{verb}:{target}"));
            edges.push(GraphEdge {
                id,
                source_id: source,
                target_id: target,
                verb,
                confidence: extra
                    .and_then(|value| value.get("confidence"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or_else(|| Some("certain".into())),
                origin: extra
                    .and_then(|value| value.get("origin"))
                    .and_then(Value::as_object)
                    .cloned(),
            });
        };

    if let Some(top_edges) = dag.get("edges").and_then(Value::as_array) {
        for edge in top_edges {
            let source = value_string(edge.get("sourceId").or_else(|| edge.get("source")));
            let target = edge
                .get("targetId")
                .or_else(|| edge.get("target"))
                .unwrap_or(&Value::Null);
            let verb = value_string(edge.get("verb").or_else(|| edge.get("type")));
            add_edge(source, target, verb, Some(edge));
        }
    } else {
        for (index, node) in raw.iter().enumerate() {
            let source = nodes[index].id.clone();
            let nested = if let Some(items) = node.as_array() {
                if items.first().is_some_and(Value::is_number) {
                    items.get(6)
                } else {
                    items.get(4)
                }
            } else {
                node.get("edges").or_else(|| node.get("es"))
            };
            for edge in nested.and_then(Value::as_array).into_iter().flatten() {
                if let Some(items) = edge.as_array() {
                    let target = items.first().unwrap_or(&Value::Null);
                    let verb = value_string(items.get(1));
                    add_edge(source.clone(), target, verb, None);
                } else {
                    let target = edge
                        .get("targetId")
                        .or_else(|| edge.get("target"))
                        .or_else(|| edge.get("t"))
                        .unwrap_or(&Value::Null);
                    let verb = value_string(
                        edge.get("verb")
                            .or_else(|| edge.get("type"))
                            .or_else(|| edge.get("v")),
                    );
                    add_edge(source.clone(), target, verb, Some(edge));
                }
            }
        }
    }
    let _ = is_v3;
    NormalizedGraph { nodes, edges }
}

fn resolve_endpoint<'a>(
    graph: &'a NormalizedGraph,
    query: &str,
) -> Result<&'a GraphNode, Option<Vec<String>>> {
    let needle = query.trim().to_ascii_lowercase();
    if needle.is_empty() {
        return Err(None);
    }
    let exact: Vec<_> = graph
        .nodes
        .iter()
        .filter(|node| {
            node.id.eq_ignore_ascii_case(&needle) || node.label.eq_ignore_ascii_case(&needle)
        })
        .collect();
    if exact.len() == 1 {
        return Ok(exact[0]);
    }
    if exact.len() > 1 {
        return Err(Some(sorted_labels(exact)));
    }
    let terms: Vec<_> = needle
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|value| !value.is_empty())
        .collect();
    let full: Vec<_> = graph
        .nodes
        .iter()
        .filter(|node| {
            let labels: HashSet<_> = node
                .label
                .to_ascii_lowercase()
                .split(|character: char| !character.is_ascii_alphanumeric())
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect();
            terms.iter().all(|term| labels.contains(*term))
        })
        .collect();
    if full.len() == 1 {
        return Ok(full[0]);
    }
    if full.len() > 1 {
        return Err(Some(sorted_labels(full)));
    }
    let partial: Vec<_> = graph
        .nodes
        .iter()
        .filter(|node| node.label.to_ascii_lowercase().contains(&needle))
        .collect();
    if partial.len() == 1 {
        Ok(partial[0])
    } else if partial.len() > 1 {
        Err(Some(sorted_labels(partial)))
    } else {
        Err(None)
    }
}

fn sorted_labels(nodes: Vec<&GraphNode>) -> Vec<String> {
    let mut labels: Vec<_> = nodes.into_iter().map(|node| node.label.clone()).collect();
    labels.sort();
    labels
}

pub fn shortest_graph_path(
    dag: &Value,
    from_query: &str,
    to_query: &str,
    direction: PathDirection,
    verb_filter: Option<&str>,
    max_hops: usize,
) -> GraphPathResult {
    let graph = normalize_graph(dag);
    let empty = |error: &str, candidates: Option<Vec<String>>| GraphPathResult {
        ok: false,
        direction,
        hops: 0,
        nodes: Vec::new(),
        edges: Vec::new(),
        from: None,
        to: None,
        error: Some(error.into()),
        candidates,
    };
    let from = match resolve_endpoint(&graph, from_query) {
        Ok(node) => node,
        Err(candidates) => {
            return empty(
                if candidates.is_some() {
                    "ambiguous_endpoint"
                } else {
                    "endpoint_not_found"
                },
                candidates,
            );
        }
    };
    let to = match resolve_endpoint(&graph, to_query) {
        Ok(node) => node,
        Err(candidates) => {
            return empty(
                if candidates.is_some() {
                    "ambiguous_endpoint"
                } else {
                    "endpoint_not_found"
                },
                candidates,
            );
        }
    };
    let from_info = EndpointInfo {
        query: from_query.into(),
        id: from.id.clone(),
        label: from.label.clone(),
    };
    let to_info = EndpointInfo {
        query: to_query.into(),
        id: to.id.clone(),
        label: to.label.clone(),
    };
    let max_hops = max_hops.clamp(1, 12);
    let verb_filter = verb_filter.unwrap_or_default().to_ascii_lowercase();
    let mut adjacency: HashMap<String, Vec<(GraphEdge, String)>> = HashMap::new();
    for edge in &graph.edges {
        if !verb_filter.is_empty() && !edge.verb.eq_ignore_ascii_case(&verb_filter) {
            continue;
        }
        if matches!(direction, PathDirection::Outgoing | PathDirection::Any) {
            adjacency
                .entry(edge.source_id.clone())
                .or_default()
                .push((edge.clone(), edge.target_id.clone()));
        }
        if matches!(direction, PathDirection::Incoming | PathDirection::Any) {
            adjacency
                .entry(edge.target_id.clone())
                .or_default()
                .push((edge.clone(), edge.source_id.clone()));
        }
    }
    let mut queue = VecDeque::from([(from.id.clone(), vec![from.id.clone()], Vec::new())]);
    let mut visited = HashSet::from([from.id.clone()]);
    let by_id: HashMap<_, _> = graph
        .nodes
        .iter()
        .map(|node| (node.id.clone(), node.clone()))
        .collect();
    while let Some((id, path_nodes, path_edges)) = queue.pop_front() {
        if id == to.id {
            return GraphPathResult {
                ok: true,
                direction,
                hops: path_edges.len(),
                nodes: path_nodes
                    .iter()
                    .filter_map(|node_id| by_id.get(node_id).cloned())
                    .collect(),
                edges: path_edges,
                from: Some(from_info),
                to: Some(to_info),
                error: None,
                candidates: None,
            };
        }
        if path_edges.len() >= max_hops {
            continue;
        }
        for (edge, next) in adjacency.get(&id).into_iter().flatten() {
            if visited.insert(next.clone()) {
                let mut next_nodes = path_nodes.clone();
                next_nodes.push(next.clone());
                let mut next_edges = path_edges.clone();
                next_edges.push(edge.clone());
                queue.push_back((next.clone(), next_nodes, next_edges));
            }
        }
    }
    GraphPathResult {
        ok: false,
        direction,
        hops: 0,
        nodes: Vec::new(),
        edges: Vec::new(),
        from: Some(from_info),
        to: Some(to_info),
        error: Some("no_path".into()),
        candidates: None,
    }
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}

impl IfEmpty for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn shortest_path_preserves_edges() {
        let graph = json!({
            "nodes": [
                {"id":"a","label":"User Service","kind":"symbol","confidence":"certain"},
                {"id":"b","label":"Database Pool","kind":"symbol","confidence":"likely"},
                {"id":"c","label":"Audit Log","kind":"file","confidence":"certain"}
            ],
            "edges": [
                {"sourceId":"a","targetId":"b","verb":"calls","confidence":"certain"},
                {"sourceId":"b","targetId":"c","verb":"writes","confidence":"likely"}
            ]
        });
        let result = shortest_graph_path(&graph, "User", "Audit Log", PathDirection::Any, None, 8);
        assert!(result.ok);
        assert_eq!(result.hops, 2);
        assert_eq!(result.edges[1].confidence.as_deref(), Some("likely"));
    }
}
