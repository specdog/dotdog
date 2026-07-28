use std::collections::{BTreeMap, BTreeSet, HashMap};

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum DesignSeverity {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignFinding {
    pub severity: DesignSeverity,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity: Option<String>,
    pub message: String,
    pub next_step: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DesignSummary {
    pub high: usize,
    pub medium: usize,
    pub low: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DesignReport {
    pub project: String,
    pub source: String,
    pub entities: usize,
    pub relationships: usize,
    pub findings: Vec<DesignFinding>,
    pub summary: DesignSummary,
    pub ok: bool,
}

#[derive(Debug)]
struct Node {
    name: String,
    kind: String,
    properties: BTreeMap<String, String>,
    states: Vec<String>,
}

fn text(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_default()
}

fn nodes(dag: &Value) -> Vec<Node> {
    let raw = dag
        .get("nodes")
        .or_else(|| dag.get("n"))
        .or_else(|| dag.as_array().and_then(|items| items.get(2)))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    raw.iter()
        .enumerate()
        .map(|(index, node)| {
            let (name, kind, properties, states) = if let Some(items) = node.as_array() {
                let v2 = items.first().is_some_and(Value::is_number);
                let name = text(items.get(usize::from(v2))).if_empty(&index.to_string());
                let kind = if v2 {
                    text(items.get(2)).if_empty("entity")
                } else {
                    match text(items.get(1)).as_str() {
                        "e" => "entity".into(),
                        "p" => "prediction".into(),
                        "i" => "infra".into(),
                        other => other.to_string(),
                    }
                };
                let property_index = if v2 { 4 } else { 2 };
                let state_index = if v2 { 5 } else { 3 };
                (
                    name,
                    kind,
                    property_map(items.get(property_index)),
                    items
                        .get(state_index)
                        .and_then(Value::as_array)
                        .map(|values| {
                            values
                                .iter()
                                .filter_map(Value::as_str)
                                .map(str::to_string)
                                .collect()
                        })
                        .unwrap_or_default(),
                )
            } else {
                (
                    text(
                        node.get("label")
                            .or_else(|| node.get("name"))
                            .or_else(|| node.get("id")),
                    )
                    .if_empty(&index.to_string()),
                    text(
                        node.get("kind")
                            .or_else(|| node.get("type"))
                            .or_else(|| node.get("t")),
                    )
                    .to_ascii_lowercase()
                    .if_empty("unknown"),
                    property_map(node.get("properties")),
                    node.get("states")
                        .and_then(Value::as_array)
                        .map(|values| {
                            values
                                .iter()
                                .filter_map(Value::as_str)
                                .map(str::to_string)
                                .collect()
                        })
                        .unwrap_or_default(),
                )
            };
            Node {
                name,
                kind,
                properties,
                states,
            }
        })
        .collect()
}

fn property_map(value: Option<&Value>) -> BTreeMap<String, String> {
    if let Some(object) = value.and_then(Value::as_object) {
        return object
            .iter()
            .map(|(key, value)| {
                (
                    key.clone(),
                    value
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| value.to_string()),
                )
            })
            .collect();
    }
    let Some(items) = value.and_then(Value::as_array) else {
        return BTreeMap::new();
    };
    let mut result = BTreeMap::new();
    for chunk in items.chunks(2) {
        if let Some(key) = chunk.first().and_then(Value::as_str) {
            result.insert(
                key.to_string(),
                chunk
                    .get(1)
                    .map(|value| text(Some(value)))
                    .unwrap_or_default(),
            );
        }
    }
    result
}

fn edge_pairs(dag: &Value, nodes: &[Node]) -> Vec<(String, String)> {
    let mut pairs = BTreeSet::new();
    let by_id: HashMap<String, String> = nodes
        .iter()
        .map(|node| (node.name.to_ascii_lowercase(), node.name.clone()))
        .collect();
    if let Some(edges) = dag.get("edges").and_then(Value::as_array) {
        for edge in edges {
            let source = text(edge.get("sourceId").or_else(|| edge.get("source")));
            let target = text(edge.get("targetId").or_else(|| edge.get("target")));
            pairs.insert((
                by_id
                    .get(&source.to_ascii_lowercase())
                    .cloned()
                    .unwrap_or(source),
                by_id
                    .get(&target.to_ascii_lowercase())
                    .cloned()
                    .unwrap_or(target),
            ));
        }
    } else {
        let raw = dag
            .get("n")
            .or_else(|| dag.as_array().and_then(|items| items.get(2)))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
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
            {
                let Some(edge) = edge.as_array() else {
                    continue;
                };
                let target = edge
                    .first()
                    .and_then(Value::as_u64)
                    .and_then(|value| nodes.get(value as usize))
                    .map(|node| node.name.clone())
                    .unwrap_or_else(|| text(edge.first()));
                pairs.insert((nodes[index].name.clone(), target));
            }
        }
    }
    pairs.into_iter().collect()
}

pub fn audit_design(dag: &Value, project: &str, source: &str) -> DesignReport {
    let all_nodes = nodes(dag);
    let entities = all_nodes
        .iter()
        .filter(|node| node.kind == "entity")
        .collect::<Vec<_>>();
    let edges = edge_pairs(dag, &all_nodes);
    let connected = edges
        .iter()
        .flat_map(|(source, target)| [source.as_str(), target.as_str()])
        .collect::<BTreeSet<_>>();
    let mut findings = Vec::new();
    let mut add = |severity, code: &str, entity: Option<&str>, message: &str, next_step: &str| {
        findings.push(DesignFinding {
            severity,
            code: code.into(),
            entity: entity.map(str::to_string),
            message: message.into(),
            next_step: next_step.into(),
        })
    };
    if entities.len() > 1 && edges.is_empty() {
        add(
            DesignSeverity::High,
            "no_relationships",
            None,
            "Multiple entities have no modeled relationships.",
            "Define the relationships, cardinality, and ownership between the core entities.",
        );
    }
    for node in &entities {
        let keys = node
            .properties
            .keys()
            .map(|key| key.to_ascii_lowercase())
            .collect::<Vec<_>>();
        if !keys
            .iter()
            .any(|key| key == "id" || key == "uuid" || key == "key" || key.ends_with("_id"))
        {
            add(
                DesignSeverity::Medium,
                "missing_identifier",
                Some(&node.name),
                "No stable identifier is modeled.",
                "Add an explicit id, uuid, key, or domain identifier and define its uniqueness.",
            );
        }
        if node.states.is_empty() {
            add(
                DesignSeverity::Medium,
                "missing_lifecycle",
                Some(&node.name),
                "No lifecycle states are modeled.",
                "Define states and allowed transitions, or document why this entity is immutable.",
            );
        }
        if !keys.iter().any(|key| {
            matches!(
                key.as_str(),
                "owner" | "owner_id" | "owned_by" | "source_of_truth" | "service"
            )
        }) {
            add(
                DesignSeverity::Medium,
                "missing_ownership",
                Some(&node.name),
                "The source of truth or owning boundary is not modeled.",
                "Name the owning service, team, or entity and identify the write authority.",
            );
        }
        if !keys.iter().any(|key| {
            matches!(
                key.as_str(),
                "read" | "reads" | "write" | "writes" | "index" | "query"
            )
        }) {
            add(
                DesignSeverity::Low,
                "missing_access_pattern",
                Some(&node.name),
                "Primary access patterns are not modeled.",
                "Document the important reads, writes, queries, or indexes before choosing storage.",
            );
        }
        if entities.len() > 1 && !connected.contains(node.name.as_str()) {
            add(
                DesignSeverity::Medium,
                "orphan_entity",
                Some(&node.name),
                "Entity is disconnected from the rest of the model.",
                "Link it to an owning workflow or remove it from the core model.",
            );
        }
    }
    findings.sort_by_key(|finding| {
        format!(
            "{:?}:{}:{}",
            finding.severity,
            finding.code,
            finding.entity.as_deref().unwrap_or_default()
        )
    });
    let summary = DesignSummary {
        high: findings
            .iter()
            .filter(|item| matches!(item.severity, DesignSeverity::High))
            .count(),
        medium: findings
            .iter()
            .filter(|item| matches!(item.severity, DesignSeverity::Medium))
            .count(),
        low: findings
            .iter()
            .filter(|item| matches!(item.severity, DesignSeverity::Low))
            .count(),
    };
    DesignReport {
        project: project.into(),
        source: source.into(),
        entities: entities.len(),
        relationships: edges.len(),
        ok: summary.high == 0,
        findings,
        summary,
    }
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
