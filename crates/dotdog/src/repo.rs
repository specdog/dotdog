use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use walkdir::WalkDir;

use crate::grammar::BlockNode;
use crate::parser::parse;
use crate::workspace::is_ignored_repo_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldNode {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub properties: BTreeMap<String, Value>,
    pub confidence: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub verb: String,
    pub confidence: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldModel {
    pub version: String,
    pub project: String,
    pub root: String,
    pub generated_at: String,
    pub nodes: Vec<WorldNode>,
    pub edges: Vec<WorldEdge>,
    #[serde(default)]
    pub predictions: Vec<Value>,
    #[serde(default)]
    pub unknowns: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoMapWriteResult {
    pub file: String,
    pub dag_file: String,
    pub facts_file: String,
    pub facts: usize,
    pub edges: usize,
    pub observed_facts: usize,
    pub scanned: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct LayerCompileResult {
    pub file: String,
    pub nodes: usize,
    pub edges: usize,
    pub unknowns: usize,
}

fn now() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs().to_string())
        .unwrap_or_default()
}

pub fn safe_project_name(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("project");
    let value = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '_' | '-') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    value.trim_matches('-').if_empty("project").into()
}

pub fn stable_id(parts: &[&str]) -> String {
    let joined = parts.join(":").to_ascii_lowercase();
    let mut output = String::new();
    let mut dash = false;
    for character in joined.chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | ':' | '/' | '-') {
            if character == '-' && dash {
                continue;
            }
            dash = character == '-';
            output.push(character);
        } else if !dash {
            output.push('-');
            dash = true;
        }
    }
    output.trim_matches('-').to_string()
}

fn add_node(
    nodes: &mut BTreeMap<String, WorldNode>,
    label: &str,
    kind: &str,
    source: &str,
    description: &str,
    properties: BTreeMap<String, Value>,
    origin: &str,
) -> String {
    let id = id_for_label(label, kind);
    nodes.entry(id.clone()).or_insert_with(|| WorldNode {
        id: id.clone(),
        kind: normalize_kind(kind),
        label: label.into(),
        source: source.into(),
        description: (!description.is_empty()).then(|| description.into()),
        properties,
        confidence: "certain".into(),
        origin: Some(json!({"type": origin, "file": source})),
    });
    id
}

fn add_edge(
    edges: &mut BTreeMap<String, WorldEdge>,
    source_id: &str,
    target_id: &str,
    verb: &str,
    source: Option<&str>,
    origin: &str,
) {
    let verb = normalize_verb(verb);
    let id = stable_id(&[source_id, &verb, target_id]);
    edges.entry(id.clone()).or_insert_with(|| WorldEdge {
        id,
        source_id: source_id.into(),
        target_id: target_id.into(),
        verb,
        confidence: "certain".into(),
        source: source.map(str::to_string),
        description: None,
        origin: source.map(|file| json!({"type": origin, "file": file})),
    });
}

fn id_for_label(label: &str, kind: &str) -> String {
    if label == "repository" {
        return "repository".into();
    }
    if let Some(file) = label.strip_prefix("file:") {
        return stable_id(&["file", file]);
    }
    if let Some(package) = label.strip_prefix("package:") {
        return stable_id(&["package", package]);
    }
    if let Some(route) = label.strip_prefix("route:") {
        return stable_id(&["symbol", route]);
    }
    stable_id(&[&normalize_kind(kind), label])
}

fn normalize_kind(kind: &str) -> String {
    match kind.to_ascii_lowercase().as_str() {
        "file" => "file",
        "symbol" | "route" | "component" | "api_route" | "page_route" => "symbol",
        "command" => "command",
        "package" | "repo" | "manifest" => "package",
        "spec" => "spec",
        "test" => "test",
        "doc" => "doc",
        "build" | "ci" | "ci_workflow" => "build",
        "output" => "output",
        "unknown" => "unknown",
        _ => "external",
    }
    .into()
}

fn normalize_verb(verb: &str) -> String {
    match verb.to_ascii_lowercase().as_str() {
        "imports" | "exports" | "defines" | "mentions" | "tests" | "builds" | "documents"
        | "depends_on" | "includes" | "implements" | "configured_by" | "deployed_by"
        | "requires" | "supports" | "generated_by" | "changed_with" | "conflicts_with" => {
            verb.to_ascii_lowercase()
        }
        "tested_by" => "tests".into(),
        "documented_by" => "documents".into(),
        "requires_env" => "requires".into(),
        _ => "depends_on".into(),
    }
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn repository_world(root: &Path, project: &str) -> Result<(WorldModel, Vec<Value>, usize)> {
    let mut nodes = BTreeMap::new();
    let mut edges = BTreeMap::new();
    add_node(
        &mut nodes,
        "repository",
        "repo",
        ".",
        "Mapped repository",
        BTreeMap::new(),
        "generated",
    );
    let mut files = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            entry.path() == root
                || !is_ignored_repo_path(entry.path().strip_prefix(root).unwrap_or(entry.path()))
        })
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .take(500)
        .map(|entry| entry.into_path())
        .collect::<Vec<_>>();
    files.sort();
    let cargo_package = Regex::new(r#"(?ms)^\[package\]\s*.*?^name\s*=\s*[\"']([^\"']+)[\"']"#)
        .expect("valid Cargo package regex");
    for path in &files {
        let file = relative(root, path);
        let lower = file.to_ascii_lowercase();
        let mut kind = None;
        let mut description = file.clone();
        if matches!(file.as_str(), "package.json" | "Cargo.toml") {
            kind = Some("manifest");
            description = if file == "Cargo.toml" {
                "Rust crate manifest".into()
            } else {
                "Node package manifest".into()
            };
        } else if matches!(
            file.as_str(),
            "railway.json" | "vercel.json" | "netlify.toml"
        ) {
            kind = Some("deployment_config");
            description = "Deployment configuration".into();
        } else if lower.contains("/test/")
            || lower.contains("/tests/")
            || lower.contains("/__tests__/")
            || lower.contains(".test.")
            || lower.contains(".spec.")
        {
            kind = Some("test");
            description = "Test file".into();
        } else if lower.ends_with(".md")
            || [
                "readme",
                "agents",
                "claude",
                "contributing",
                "security",
                "changelog",
                "license",
            ]
            .iter()
            .any(|prefix| lower.starts_with(prefix))
        {
            kind = Some("doc");
            description = "Documentation".into();
        } else if lower.starts_with(".github/workflows/")
            && (lower.ends_with(".yml") || lower.ends_with(".yaml"))
        {
            kind = Some("ci_workflow");
            description = "GitHub Actions workflow".into();
        } else if Path::new(&file)
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "rs" | "ts"
                        | "tsx"
                        | "js"
                        | "jsx"
                        | "mjs"
                        | "cjs"
                        | "py"
                        | "go"
                        | "java"
                        | "kt"
                        | "kts"
                        | "rb"
                        | "php"
                        | "swift"
                        | "c"
                        | "cc"
                        | "cpp"
                        | "h"
                        | "hpp"
                        | "cs"
                        | "vue"
                        | "svelte"
                        | "sql"
                )
            })
        {
            kind = Some("source_file");
            description = "Source file".into();
        }
        let Some(kind) = kind else { continue };
        let file_label = format!("file:{file}");
        let file_id = add_node(
            &mut nodes,
            &file_label,
            kind,
            &file,
            &description,
            BTreeMap::new(),
            "generated",
        );
        add_edge(
            &mut edges,
            "repository",
            &file_id,
            if kind == "doc" {
                "documents"
            } else {
                "configured_by"
            },
            Some(&file),
            "generated",
        );
        if file == "package.json" {
            if let Ok(package) = serde_json::from_slice::<Value>(&fs::read(path)?) {
                if let Some(name) = package.get("name").and_then(Value::as_str) {
                    let package_id = add_node(
                        &mut nodes,
                        &format!("package:{name}"),
                        "package",
                        &file,
                        package
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or(name),
                        BTreeMap::new(),
                        "generated",
                    );
                    add_edge(
                        &mut edges,
                        &file_id,
                        &package_id,
                        "defines",
                        Some(&file),
                        "generated",
                    );
                }
            }
        } else if file == "Cargo.toml" {
            if let Ok(manifest) = fs::read_to_string(path) {
                let package = cargo_package
                    .captures(&manifest)
                    .and_then(|captures| captures.get(1))
                    .map(|value| value.as_str().to_string());
                if let Some(name) = package {
                    let package_id = add_node(
                        &mut nodes,
                        &format!("crate:{name}"),
                        "package",
                        &file,
                        &name,
                        BTreeMap::new(),
                        "generated",
                    );
                    add_edge(
                        &mut edges,
                        &file_id,
                        &package_id,
                        "defines",
                        Some(&file),
                        "generated",
                    );
                }
            }
        }
        let provider = match file.as_str() {
            "railway.json" => Some(("RailwayService", "railway")),
            "vercel.json" => Some(("VercelApp", "vercel")),
            "netlify.toml" => Some(("NetlifySite", "netlify")),
            _ => None,
        };
        if let Some((label, provider)) = provider {
            let deployment = add_node(
                &mut nodes,
                "Deployment",
                "external",
                &file,
                "Detected deployment capability",
                BTreeMap::new(),
                "generated",
            );
            let mut properties = BTreeMap::new();
            properties.insert("provider".into(), json!(provider));
            let service = add_node(
                &mut nodes,
                label,
                "external",
                &file,
                "Detected deployment service",
                properties,
                "generated",
            );
            add_edge(
                &mut edges,
                &deployment,
                &service,
                "includes",
                Some(&file),
                "generated",
            );
            add_edge(
                &mut edges,
                &service,
                &file_id,
                "configured_by",
                Some(&file),
                "generated",
            );
        }
    }
    let facts = graph_facts(project, nodes.values(), edges.values());
    Ok((
        WorldModel {
            version: "0.1".into(),
            project: project.into(),
            root: ".".into(),
            generated_at: now(),
            nodes: nodes.into_values().collect(),
            edges: edges.into_values().collect(),
            predictions: Vec::new(),
            unknowns: Vec::new(),
        },
        facts,
        files.len(),
    ))
}

fn graph_facts<'a>(
    project: &str,
    nodes: impl Iterator<Item = &'a WorldNode>,
    edges: impl Iterator<Item = &'a WorldEdge>,
) -> Vec<Value> {
    let mut facts = nodes.map(|node| {
        let object = if node.id == "repository" { "repo" } else { node.kind.as_str() };
        json!({"id": stable_id(&["fact", project, &node.label, "is", object]), "subject": node.label, "predicate": "is", "object": object, "repo": project, "file": node.source, "confidence": "compiled", "source": if node.kind == "package" { "package" } else { "code" }})
    }).chain(
        edges.map(|edge| json!({"id": stable_id(&["fact", project, &edge.source_id, &edge.verb, &edge.target_id]), "subject": edge.source_id, "predicate": edge.verb, "object": edge.target_id, "repo": project, "confidence": "compiled", "source": "code"}))
    ).collect::<Vec<_>>();
    facts.sort_by_key(|fact| {
        fact.get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    });
    facts
}

fn render_repo_map(model: &WorldModel) -> String {
    let mut lines = vec![
        "# Repo Map".into(),
        String::new(),
        format!(
            "> Generated by dotdog map. Project: {}. Source: repository root.",
            model.project
        ),
        String::new(),
        "## Implementation Map".into(),
        String::new(),
    ];
    for node in &model.nodes {
        lines.extend([
            format!("### Entity: {}", node.label),
            String::new(),
            node.description
                .clone()
                .unwrap_or_else(|| node.label.clone()),
            String::new(),
            "```yaml".into(),
            format!("entity: {}", node.label),
            format!("type: {}", node.kind),
            "```".into(),
            String::new(),
        ]);
    }
    let labels = model
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node.label.as_str()))
        .collect::<BTreeMap<_, _>>();
    for edge in &model.edges {
        let source = labels
            .get(edge.source_id.as_str())
            .copied()
            .unwrap_or(&edge.source_id);
        let target = labels
            .get(edge.target_id.as_str())
            .copied()
            .unwrap_or(&edge.target_id);
        lines.extend([
            format!("### Relationship: {source} → {target}"),
            String::new(),
            "```yaml".into(),
            format!("relationship: {source} → {target}"),
            format!("source: {source}"),
            format!("target: {target}"),
            format!("verb: {}", edge.verb),
            "cardinality: N:1".into(),
            "required: false".into(),
            "```".into(),
            String::new(),
        ]);
    }
    lines.join("\n")
}

pub fn write_repo_map(root: &Path, project: &str, output_dir: &Path) -> Result<RepoMapWriteResult> {
    let (model, facts, scanned) = repository_world(root, project)?;
    fs::create_dir_all(output_dir)?;
    let dog_file = output_dir.join("repo-map.dog");
    let dag_file = output_dir.join("repo.dag");
    let facts_file = output_dir.join("facts.jsonl");
    fs::write(&dog_file, render_repo_map(&model))?;
    fs::write(
        &dag_file,
        format!("{}\n", serde_json::to_string_pretty(&model)?),
    )?;
    let jsonl = facts
        .iter()
        .map(serde_json::to_string)
        .collect::<std::result::Result<Vec<_>, _>>()?
        .join("\n");
    fs::write(&facts_file, format!("{jsonl}\n"))?;
    Ok(RepoMapWriteResult {
        file: dog_file.display().to_string(),
        dag_file: dag_file.display().to_string(),
        facts_file: facts_file.display().to_string(),
        facts: model.nodes.len(),
        edges: model.edges.len(),
        observed_facts: facts.len(),
        scanned,
    })
}

fn load_authored_layer(
    dir: &Path,
    origin: &str,
    nodes: &mut BTreeMap<String, WorldNode>,
    edges: &mut BTreeMap<String, WorldEdge>,
    unknowns: &mut BTreeSet<String>,
) -> Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    let mut files = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("dog"))
        .collect::<Vec<_>>();
    files.sort();
    for file in files {
        let source = fs::read_to_string(&file)?;
        let document = parse(&source);
        for block in document.sections.iter().flat_map(|section| &section.blocks) {
            match block {
                BlockNode::Entity {
                    name,
                    description,
                    entity_type,
                    properties,
                    ..
                } => {
                    let compact = properties
                        .iter()
                        .filter_map(|(key, value)| {
                            value.default.clone().map(|value| (key.clone(), value))
                        })
                        .collect();
                    add_node(
                        nodes,
                        name,
                        entity_type,
                        &file.display().to_string(),
                        description,
                        compact,
                        origin,
                    );
                }
                BlockNode::Event { name, .. } => {
                    add_node(
                        nodes,
                        name,
                        "external",
                        &file.display().to_string(),
                        "",
                        BTreeMap::new(),
                        origin,
                    );
                }
                _ => {}
            }
        }
        for block in document.sections.iter().flat_map(|section| &section.blocks) {
            if let BlockNode::Relationship {
                source,
                target,
                verb,
                ..
            } = block
            {
                let source_id = nodes
                    .values()
                    .find(|node| node.label == *source)
                    .map(|node| node.id.clone())
                    .unwrap_or_else(|| {
                        unknowns.insert(format!("{source} referenced by {}", file.display()));
                        add_node(
                            nodes,
                            source,
                            "unknown",
                            &file.display().to_string(),
                            "Referenced but not found",
                            BTreeMap::new(),
                            origin,
                        )
                    });
                let target_id = nodes
                    .values()
                    .find(|node| node.label == *target)
                    .map(|node| node.id.clone())
                    .unwrap_or_else(|| {
                        unknowns.insert(format!("{target} referenced by {}", file.display()));
                        add_node(
                            nodes,
                            target,
                            "unknown",
                            &file.display().to_string(),
                            "Referenced but not found",
                            BTreeMap::new(),
                            origin,
                        )
                    });
                add_edge(
                    edges,
                    &source_id,
                    &target_id,
                    verb,
                    Some(&file.display().to_string()),
                    origin,
                );
            }
        }
    }
    Ok(())
}

pub fn compile_layers(root: &Path, project: &str) -> Result<Option<LayerCompileResult>> {
    let doghouse = root.join(".doghouse");
    let generated = doghouse.join("generated/repo.dag");
    let semantic = doghouse.join("semantic");
    let overlays = doghouse.join("overlays");
    if !generated.is_file() && !semantic.is_dir() && !overlays.is_dir() {
        return Ok(None);
    }
    let base = if generated.is_file() {
        serde_json::from_slice::<WorldModel>(&fs::read(&generated)?)?
    } else {
        WorldModel {
            version: "0.1".into(),
            project: project.into(),
            root: ".".into(),
            generated_at: now(),
            nodes: Vec::new(),
            edges: Vec::new(),
            predictions: Vec::new(),
            unknowns: Vec::new(),
        }
    };
    let mut nodes = base
        .nodes
        .into_iter()
        .map(|node| (node.id.clone(), node))
        .collect::<BTreeMap<_, _>>();
    let mut edges = base
        .edges
        .into_iter()
        .map(|edge| (edge.id.clone(), edge))
        .collect::<BTreeMap<_, _>>();
    let mut unknowns = base.unknowns.into_iter().collect::<BTreeSet<_>>();
    load_authored_layer(&semantic, "semantic", &mut nodes, &mut edges, &mut unknowns)?;
    load_authored_layer(&overlays, "overlay", &mut nodes, &mut edges, &mut unknowns)?;
    let compiled = WorldModel {
        version: "0.1".into(),
        project: project.into(),
        root: ".".into(),
        generated_at: now(),
        nodes: nodes.into_values().collect(),
        edges: edges.into_values().collect(),
        predictions: base.predictions,
        unknowns: unknowns.into_iter().collect(),
    };
    let output = doghouse.join("compiled/repo.dag");
    fs::create_dir_all(output.parent().context("compiled output has no parent")?)?;
    fs::write(
        &output,
        format!("{}\n", serde_json::to_string_pretty(&compiled)?),
    )?;
    Ok(Some(LayerCompileResult {
        file: output.display().to_string(),
        nodes: compiled.nodes.len(),
        edges: compiled.edges.len(),
        unknowns: compiled.unknowns.len(),
    }))
}

pub fn load_world(path: &Path) -> Result<WorldModel> {
    let model: WorldModel = serde_json::from_slice(&fs::read(path)?)?;
    if model.version != "0.1" {
        anyhow::bail!("Not a dotdog repo.dag file: {}", path.display());
    }
    Ok(model)
}

pub fn query_world(model: &WorldModel, query: &str, limit: usize) -> Value {
    let terms = query
        .to_ascii_lowercase()
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let nodes = model
        .nodes
        .iter()
        .filter(|node| {
            let haystack = format!(
                "{} {} {} {} {:?}",
                node.id, node.kind, node.label, node.source, node.properties
            )
            .to_ascii_lowercase();
            terms.iter().all(|term| haystack.contains(term))
        })
        .take(limit)
        .cloned()
        .collect::<Vec<_>>();
    let ids = nodes
        .iter()
        .map(|node| node.id.as_str())
        .collect::<BTreeSet<_>>();
    let edges = model
        .edges
        .iter()
        .filter(|edge| {
            ids.contains(edge.source_id.as_str()) || ids.contains(edge.target_id.as_str())
        })
        .take(limit * 2)
        .cloned()
        .collect::<Vec<_>>();
    json!({"nodes": nodes, "edges": edges, "predictions": [], "unknowns": model.unknowns.iter().filter(|unknown| terms.iter().all(|term| unknown.to_ascii_lowercase().contains(term))).take(limit).collect::<Vec<_>>()})
}

pub fn format_query(result: &Value) -> String {
    let mut lines = Vec::new();
    if let Some(nodes) = result
        .get("nodes")
        .and_then(Value::as_array)
        .filter(|nodes| !nodes.is_empty())
    {
        lines.push("Nodes".into());
        for node in nodes {
            lines.push(format!(
                "- {} [{}] {}",
                node["id"].as_str().unwrap_or_default(),
                node["kind"].as_str().unwrap_or_default(),
                node["source"].as_str().unwrap_or_default()
            ));
        }
    }
    if let Some(edges) = result
        .get("edges")
        .and_then(Value::as_array)
        .filter(|edges| !edges.is_empty())
    {
        lines.push("Edges".into());
        for edge in edges {
            lines.push(format!(
                "- {} --{}--> {}",
                edge["sourceId"].as_str().unwrap_or_default(),
                edge["verb"].as_str().unwrap_or_default(),
                edge["targetId"].as_str().unwrap_or_default()
            ));
        }
    }
    if lines.is_empty() {
        "No DAG matches.".into()
    } else {
        lines.join("\n")
    }
}

trait IfEmpty {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str;
}
impl IfEmpty for str {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str {
        if self.is_empty() { fallback } else { self }
    }
}
