use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use anyhow::{Context, Result, bail};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const WORKSPACE_MANIFEST: &str = ".doghouse/workspace.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceIdentity {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoConfig {
    pub alias: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceGroup {
    pub name: String,
    pub repos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEdge {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub version: u8,
    pub workspace: WorkspaceIdentity,
    pub repos: Vec<RepoConfig>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<WorkspaceGroup>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub edges: Vec<WorkspaceEdge>,
}

#[derive(Debug, Clone)]
pub struct RepoContext {
    pub alias: String,
    pub role: String,
    pub cwd: PathBuf,
    pub remote: Option<String>,
    pub default_branch: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceContext {
    pub manifest_path: Option<PathBuf>,
    pub workspace_root: PathBuf,
    pub config: WorkspaceConfig,
    pub repos: Vec<RepoContext>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationIssue {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationIssue>,
    pub warnings: Vec<ValidationIssue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceGraphNode {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(rename = "repoAlias", skip_serializing_if = "Option::is_none")]
    pub repo_alias: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceGraphEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceGraph {
    pub version: u8,
    pub workspace: String,
    pub nodes: Vec<WorkspaceGraphNode>,
    pub edges: Vec<WorkspaceGraphEdge>,
}

fn issue(
    code: &str,
    message: impl Into<String>,
    path: impl Into<Option<String>>,
) -> ValidationIssue {
    ValidationIssue {
        code: code.into(),
        message: message.into(),
        path: path.into(),
    }
}

pub fn validate_workspace_value(
    value: &Value,
    manifest_dir: Option<&Path>,
    check_paths: bool,
) -> ValidationResult {
    let mut errors = Vec::new();
    if !value.is_object() {
        return ValidationResult {
            valid: false,
            errors: vec![issue(
                "invalid_config",
                "Workspace config must be an object.",
                None,
            )],
            warnings: Vec::new(),
        };
    }
    let config = serde_json::from_value::<WorkspaceConfig>(value.clone());
    let Ok(config) = config else {
        return ValidationResult {
            valid: false,
            errors: vec![issue(
                "invalid_config",
                "Workspace config fields are invalid.",
                None,
            )],
            warnings: Vec::new(),
        };
    };
    if config.version != 1 {
        errors.push(issue(
            "invalid_version",
            "Only workspace manifest version 1 is supported.",
            Some("version".into()),
        ));
    }
    if config.workspace.id.is_empty() {
        errors.push(issue(
            "missing_workspace_id",
            "workspace.id is required.",
            Some("workspace.id".into()),
        ));
    }
    if config.repos.is_empty() {
        errors.push(issue(
            "missing_repos",
            "At least one repo is required.",
            Some("repos".into()),
        ));
    }
    let alias_pattern = Regex::new(r"^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$").expect("valid regex");
    let mut aliases = HashSet::new();
    let mut paths = HashSet::new();
    for (index, repo) in config.repos.iter().enumerate() {
        let base = format!("repos[{index}]");
        if !alias_pattern.is_match(&repo.alias) {
            errors.push(issue(
                "invalid_repo_alias",
                format!("Invalid repo alias: {}", repo.alias),
                Some(format!("{base}.alias")),
            ));
        }
        if !aliases.insert(repo.alias.clone()) {
            errors.push(issue(
                "duplicate_repo_alias",
                format!("Duplicate repo alias: {}", repo.alias),
                Some(format!("{base}.alias")),
            ));
        }
        if repo.path.is_empty() {
            errors.push(issue(
                "missing_repo_path",
                format!("Repo path is required for {}.", repo.alias),
                Some(format!("{base}.path")),
            ));
            continue;
        }
        if repo.path.contains('\0') {
            errors.push(issue(
                "unsafe_path",
                format!("Repo path contains a control character: {}", repo.path),
                Some(format!("{base}.path")),
            ));
        }
        if let Some(dir) = manifest_dir {
            let resolved = dir.join(&repo.path);
            let key = resolved.components().collect::<PathBuf>();
            if !paths.insert(key) {
                errors.push(issue(
                    "duplicate_repo_path",
                    format!("Duplicate repo path: {}", repo.path),
                    Some(format!("{base}.path")),
                ));
            }
            if check_paths && !resolved.is_dir() {
                errors.push(issue(
                    "repo_path_not_found",
                    format!("Repo path not found: {}", repo.path),
                    Some(format!("{base}.path")),
                ));
            }
        }
    }
    for (index, group) in config.groups.iter().enumerate() {
        for alias in &group.repos {
            if !aliases.contains(alias) {
                errors.push(issue(
                    "unknown_group_repo",
                    format!(
                        "Group \"{}\" references unknown repo \"{alias}\".",
                        group.name
                    ),
                    Some(format!("groups[{index}].repos")),
                ));
            }
        }
    }
    for (index, edge) in config.edges.iter().enumerate() {
        if !aliases.contains(&edge.from) {
            errors.push(issue(
                "unknown_edge_from",
                format!("Edge references unknown source repo \"{}\".", edge.from),
                Some(format!("edges[{index}].from")),
            ));
        }
        if !aliases.contains(&edge.to) {
            errors.push(issue(
                "unknown_edge_to",
                format!("Edge references unknown target repo \"{}\".", edge.to),
                Some(format!("edges[{index}].to")),
            ));
        }
        if edge.type_name.is_empty() {
            errors.push(issue(
                "missing_edge_type",
                format!("Edge \"{}\" -> \"{}\" is missing type.", edge.from, edge.to),
                Some(format!("edges[{index}].type")),
            ));
        }
    }
    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings: Vec::new(),
    }
}

pub fn find_workspace_manifest(start: &Path) -> Option<PathBuf> {
    let mut dir = start.canonicalize().ok()?;
    loop {
        let candidate = dir.join(WORKSPACE_MANIFEST);
        if candidate.is_file() {
            return Some(candidate);
        }
        if !dir.pop() {
            return None;
        }
    }
}

pub fn resolve_workspace(start: &Path, require_manifest: bool) -> Result<WorkspaceContext> {
    let start = start.canonicalize()?;
    let Some(manifest) = find_workspace_manifest(&start) else {
        if require_manifest {
            bail!("No {WORKSPACE_MANIFEST} found from {}", start.display());
        }
        let alias = start
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("repo")
            .to_string();
        let config = WorkspaceConfig {
            version: 1,
            workspace: WorkspaceIdentity {
                id: alias.clone(),
                name: Some(alias.clone()),
                description: None,
            },
            repos: vec![RepoConfig {
                alias: alias.clone(),
                role: Some("unknown".into()),
                path: ".".into(),
                remote: None,
                default_branch: None,
            }],
            groups: Vec::new(),
            edges: Vec::new(),
        };
        return Ok(WorkspaceContext {
            manifest_path: None,
            workspace_root: start.clone(),
            config,
            repos: vec![RepoContext {
                alias,
                role: "unknown".into(),
                cwd: start,
                remote: None,
                default_branch: None,
            }],
        });
    };
    let manifest_dir = manifest
        .parent()
        .context("workspace manifest has no parent")?;
    let value: Value = serde_json::from_slice(&fs::read(&manifest)?)?;
    let validation = validate_workspace_value(&value, Some(manifest_dir), true);
    if !validation.valid {
        bail!(
            "Invalid workspace manifest:\n{}",
            validation
                .errors
                .iter()
                .map(|error| format!("- {}", error.message))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }
    let config: WorkspaceConfig = serde_json::from_value(value)?;
    let repos = config
        .repos
        .iter()
        .map(|repo| {
            Ok(RepoContext {
                alias: repo.alias.clone(),
                role: repo.role.clone().unwrap_or_else(|| "unknown".into()),
                cwd: manifest_dir.join(&repo.path).canonicalize()?,
                remote: repo.remote.clone(),
                default_branch: repo.default_branch.clone(),
            })
        })
        .collect::<Result<Vec<_>>>()?;
    let workspace_root = manifest_dir.parent().unwrap_or(manifest_dir).to_path_buf();
    Ok(WorkspaceContext {
        manifest_path: Some(manifest),
        workspace_root,
        config,
        repos,
    })
}

pub fn portable_path(context: &WorkspaceContext, path: &Path) -> String {
    relative_path(&context.workspace_root, path)
        .to_string_lossy()
        .replace('\\', "/")
        .if_empty(".")
}

pub fn relative_path(base: &Path, target: &Path) -> PathBuf {
    let base = base.components().collect::<Vec<_>>();
    let target = target.components().collect::<Vec<_>>();
    let common = base
        .iter()
        .zip(&target)
        .take_while(|(left, right)| left == right)
        .count();
    if common == 0 {
        return target.iter().collect();
    }
    let mut result = PathBuf::new();
    for component in &base[common..] {
        if matches!(component, Component::Normal(_)) {
            result.push("..");
        }
    }
    for component in &target[common..] {
        result.push(component.as_os_str());
    }
    if result.as_os_str().is_empty() {
        result.push(".");
    }
    result
}

pub fn build_workspace_graph(context: &WorkspaceContext) -> WorkspaceGraph {
    let workspace_id = &context.config.workspace.id;
    let root_id = format!("workspace:{workspace_id}");
    let mut nodes = vec![WorkspaceGraphNode {
        id: root_id.clone(),
        kind: "workspace".into(),
        label: workspace_id.clone(),
        repo_alias: None,
        path: Some(".".into()),
        metadata: None,
    }];
    let mut edges = Vec::new();
    let mut repos = context.repos.iter().collect::<Vec<_>>();
    repos.sort_by_key(|repo| &repo.alias);
    for repo in repos {
        let id = format!("repo:{}", repo.alias);
        nodes.push(WorkspaceGraphNode {
            id: id.clone(),
            kind: "repo".into(),
            label: repo.alias.clone(),
            repo_alias: Some(repo.alias.clone()),
            path: Some(portable_path(context, &repo.cwd)),
            metadata: Some(serde_json::json!({"role": repo.role})),
        });
        edges.push(WorkspaceGraphEdge {
            id: format!("{root_id}:contains:{id}"),
            from: root_id.clone(),
            to: id,
            type_name: "contains".into(),
            label: None,
            confidence: "explicit".into(),
        });
    }
    let mut groups = context.config.groups.iter().collect::<Vec<_>>();
    groups.sort_by_key(|group| &group.name);
    for group in groups {
        let id = format!("group:{}", group.name);
        nodes.push(WorkspaceGraphNode {
            id: id.clone(),
            kind: "group".into(),
            label: group.name.clone(),
            repo_alias: None,
            path: None,
            metadata: None,
        });
        edges.push(WorkspaceGraphEdge {
            id: format!("{root_id}:contains:{id}"),
            from: root_id.clone(),
            to: id.clone(),
            type_name: "contains".into(),
            label: None,
            confidence: "explicit".into(),
        });
        let mut aliases = group.repos.clone();
        aliases.sort();
        for alias in aliases {
            edges.push(WorkspaceGraphEdge {
                id: format!("{id}:includes:repo:{alias}"),
                from: id.clone(),
                to: format!("repo:{alias}"),
                type_name: "includes".into(),
                label: None,
                confidence: "explicit".into(),
            });
        }
    }
    for edge in &context.config.edges {
        edges.push(WorkspaceGraphEdge {
            id: format!("repo:{}:{}:repo:{}", edge.from, edge.type_name, edge.to),
            from: format!("repo:{}", edge.from),
            to: format!("repo:{}", edge.to),
            type_name: edge.type_name.clone(),
            label: edge.label.clone(),
            confidence: "explicit".into(),
        });
    }
    nodes.sort_by_key(|node| {
        format!(
            "{}:{}",
            match node.kind.as_str() {
                "workspace" => 0,
                "repo" => 1,
                "group" => 2,
                _ => 3,
            },
            node.id
        )
    });
    edges.sort_by_key(|edge| format!("{}:{}:{}", edge.from, edge.to, edge.type_name));
    WorkspaceGraph {
        version: 1,
        workspace: workspace_id.clone(),
        nodes,
        edges,
    }
}

pub fn resolve_user_path(input: &Path, root: &Path) -> Result<PathBuf> {
    if input.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        bail!("Path outside allowed roots: {}", input.display());
    }
    let root = root.canonicalize()?;
    let target = root.join(input);
    let resolved = if target.exists() {
        target.canonicalize()?
    } else {
        target
            .parent()
            .context("path has no parent")?
            .canonicalize()?
            .join(target.file_name().context("path has no file name")?)
    };
    if resolved != root && !resolved.starts_with(&root) {
        bail!("Path outside allowed roots: {}", resolved.display());
    }
    Ok(resolved)
}

pub fn is_ignored_repo_path(path: &Path) -> bool {
    let ignored = [
        ".aws",
        ".azure",
        ".cache",
        ".gcp",
        ".git",
        ".next",
        ".ssh",
        ".turbo",
        ".vercel",
        "build",
        "coverage",
        "dist",
        "node_modules",
    ];
    if path
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .any(|part| ignored.contains(&part))
    {
        return true;
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    name == ".env"
        || name.starts_with(".env.")
        || [".pem", ".key", ".p12", ".crt"]
            .iter()
            .any(|suffix| name.ends_with(suffix))
        || matches!(name.as_str(), "id_rsa" | "id_ed25519")
}

pub fn redact_secrets(input: &str) -> String {
    let mut output = input.to_string();
    for pattern in [
        r"AKIA[0-9A-Z]{16}",
        r"ghp_[A-Za-z0-9_]{30,}",
        r"github_pat_[A-Za-z0-9_]+",
        r"sk-[A-Za-z0-9_-]+",
        r"xox[baprs]-[A-Za-z0-9-]+",
    ] {
        output = Regex::new(pattern)
            .expect("valid regex")
            .replace_all(&output, "[REDACTED]")
            .into_owned();
    }
    output
}

pub fn public_workspace(context: &WorkspaceContext) -> Value {
    serde_json::json!({
        "mode": if context.manifest_path.is_some() { "workspace" } else { "single-repo" },
        "workspace": context.config.workspace,
        "repos": context.repos.iter().map(|repo| serde_json::json!({
            "alias": repo.alias,
            "role": repo.role,
            "path": portable_path(context, &repo.cwd),
            "cwd": portable_path(context, &repo.cwd),
            "remote": repo.remote,
            "defaultBranch": repo.default_branch,
        })).collect::<Vec<_>>(),
        "groups": context.config.groups,
    })
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

pub fn selected_repos<'a>(
    context: &'a WorkspaceContext,
    repo: Option<&str>,
    group: Option<&str>,
) -> Result<Vec<&'a RepoContext>> {
    if let Some(alias) = repo {
        return context
            .repos
            .iter()
            .find(|candidate| candidate.alias == alias)
            .map(|repo| vec![repo])
            .context("unknown repo alias");
    }
    if let Some(name) = group {
        let aliases = context
            .config
            .groups
            .iter()
            .find(|candidate| candidate.name == name)
            .map(|group| group.repos.iter().collect::<BTreeSet<_>>())
            .context("unknown workspace group")?;
        return Ok(context
            .repos
            .iter()
            .filter(|repo| aliases.contains(&repo.alias))
            .collect());
    }
    Ok(context.repos.iter().collect())
}
