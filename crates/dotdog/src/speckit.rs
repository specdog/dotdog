use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path};

use anyhow::{Context, Result, bail};
use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCounts {
    pub user_stories: usize,
    pub requirements: usize,
    pub success_criteria: usize,
    pub tasks: usize,
    pub entities: usize,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct FeatureImport {
    pub id: String,
    pub title: String,
    pub source: String,
    pub output: String,
    pub artifacts: Vec<String>,
    pub counts: ImportCounts,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ImportSummary {
    pub written: usize,
    pub unchanged: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub root: String,
    pub output: String,
    pub features: Vec<FeatureImport>,
    pub summary: ImportSummary,
    pub actions: Vec<ImportAction>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportAction {
    pub path: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, serde::Deserialize)]
struct Manifest {
    #[serde(default = "manifest_version")]
    version: u8,
    #[serde(default = "manifest_source")]
    source: String,
    output: String,
    files: BTreeMap<String, String>,
    #[serde(default)]
    features: Vec<FeatureImport>,
}

impl Default for Manifest {
    fn default() -> Self {
        Self {
            version: manifest_version(),
            source: manifest_source(),
            output: String::new(),
            files: BTreeMap::new(),
            features: Vec::new(),
        }
    }
}

fn manifest_version() -> u8 {
    1
}

fn manifest_source() -> String {
    "github-spec-kit".into()
}

#[derive(Debug)]
struct Item {
    id: String,
    title: String,
    description: String,
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn portable(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
        .if_empty(".")
        .into()
}

fn validate_output(root: &Path, output: &Path) -> Result<()> {
    if output.is_absolute()
        || output.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        bail!("Spec Kit output must be a subdirectory of the project root");
    }
    let first = output
        .components()
        .next()
        .and_then(|value| value.as_os_str().to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(first.as_str(), ".git" | ".specify" | "specs") {
        bail!("Spec Kit output cannot overwrite repository or source metadata");
    }
    let mut cursor = root.to_path_buf();
    for component in output.components() {
        cursor.push(component);
        if cursor.exists() && fs::symlink_metadata(&cursor)?.file_type().is_symlink() {
            bail!("symlinked Spec Kit output path: {}", cursor.display());
        }
    }
    Ok(())
}

fn read_source(root: &Path, path: &Path) -> Result<String> {
    let relative = path
        .strip_prefix(root)
        .context("Spec Kit source outside project root")?;
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        cursor.push(component);
        if fs::symlink_metadata(&cursor)?.file_type().is_symlink() {
            bail!("symlinked Spec Kit source path: {}", cursor.display());
        }
    }
    Ok(fs::read_to_string(path)?)
}

fn title(source: &str, fallback: &str) -> String {
    Regex::new(r"(?m)^# (?:Feature Specification|Implementation Plan):\s*(.+)$")
        .expect("valid regex")
        .captures(source)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str().trim().to_string())
        .unwrap_or_else(|| fallback.replace('-', " "))
}

fn items(source: &str, pattern: &str) -> Vec<Item> {
    let regex = Regex::new(pattern).expect("valid item regex");
    regex
        .captures_iter(source)
        .filter_map(|captures| {
            Some(Item {
                id: captures.get(1)?.as_str().to_string(),
                title: captures.get(2)?.as_str().trim().to_string(),
                description: captures
                    .get(3)
                    .map(|value| value.as_str().trim().to_string())
                    .unwrap_or_default(),
            })
        })
        .collect()
}

fn entity_name(value: &str) -> String {
    let cleaned = value
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, ' ' | '.' | '_' | '-')
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    cleaned.if_empty("Unknown").to_string()
}

fn section(source: &str, heading: &str) -> String {
    let lines = source.lines().collect::<Vec<_>>();
    let Some(start) = lines.iter().position(|line| {
        let trimmed = line.trim();
        let hashes = trimmed.chars().take_while(|value| *value == '#').count();
        (2..=3).contains(&hashes) && trimmed[hashes..].trim() == heading
    }) else {
        return String::new();
    };
    lines[start + 1..]
        .iter()
        .take_while(|line| {
            let trimmed = line.trim_start();
            !(trimmed.starts_with("## ") || trimmed.starts_with("### "))
        })
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_spec(feature: &str, source: &str, tasks_source: &str) -> (String, ImportCounts, String) {
    let feature_title = title(source, feature);
    let stories = items(
        source,
        r"(?m)^### User Story\s+(\d+)\s*-\s*(.+?)(?:\s*\(Priority:.*)?$\n(?:\s*\n)?([^#\n].*)?",
    )
    .into_iter()
    .map(|mut item| {
        item.id = format!("US{}", item.id);
        item
    })
    .collect::<Vec<_>>();
    let requirements = items(source, r"(?m)^- \*\*(FR-[0-9]+)\*\*:\s*(.+?)(?:\s*$)(.*)?");
    let success = items(source, r"(?m)^- \*\*(SC-[0-9]+)\*\*:\s*(.+?)(?:\s*$)(.*)?");
    let entity_section = section(source, "Key Entities");
    let entities = items(
        &entity_section,
        r"(?m)^- \*\*([^*]+)\*\*:\s*(.+?)(?:\s*$)(.*)?",
    )
    .into_iter()
    .map(|mut item| {
        item.id = entity_name(&item.id);
        item
    })
    .collect::<Vec<_>>();
    let task_pattern =
        Regex::new(r"(?m)^- \[[ xX]\]\s+(T[0-9]+)(?:\s+\[P\])?(?:\s+\[(US[0-9]+)\])?\s+(.+)$")
            .expect("valid task regex");
    let tasks = task_pattern
        .captures_iter(tasks_source)
        .filter_map(|captures| {
            Some((
                captures.get(1)?.as_str().to_string(),
                captures.get(2).map(|value| value.as_str().to_string()),
                captures.get(3)?.as_str().trim().to_string(),
            ))
        })
        .collect::<Vec<_>>();
    let mut output = vec![
        format!("# Spec Kit Import: {feature_title}"),
        String::new(),
        format!(
            "> Imported from specs/{feature}/spec.md. Edit the Spec Kit source, then re-run dotdog speckit import."
        ),
        String::new(),
        "## Feature".into(),
        String::new(),
        format!("### Entity: {feature}"),
        String::new(),
        feature_title.clone(),
        String::new(),
        "```yaml".into(),
        format!("entity: {feature}"),
        "type: feature".into(),
        "```".into(),
        String::new(),
    ];
    let mut add = |item: &Item, kind: &str| {
        output.extend([
            format!("### Entity: {}", item.id),
            String::new(),
            if item.description.is_empty() {
                item.title.clone()
            } else {
                format!("{} {}", item.title, item.description)
            },
            String::new(),
            "```yaml".into(),
            format!("entity: {}", item.id),
            format!("type: {kind}"),
            "```".into(),
            String::new(),
        ]);
    };
    for item in &stories {
        add(item, "user_story");
    }
    for item in &requirements {
        add(item, "requirement");
    }
    for item in &success {
        add(item, "success_criterion");
    }
    for item in &entities {
        add(item, "entity");
    }
    for (id, _, description) in &tasks {
        add(
            &Item {
                id: id.clone(),
                title: description.clone(),
                description: String::new(),
            },
            "task",
        );
    }
    for (task, story, _) in &tasks {
        if let Some(story) = story {
            output.extend([
                format!("### Relationship: {task} → {story}"),
                String::new(),
                "```yaml".into(),
                format!("relationship: {task} → {story}"),
                format!("source: {task}"),
                format!("target: {story}"),
                "verb: implements".into(),
                "cardinality: N:1".into(),
                "required: false".into(),
                "```".into(),
                String::new(),
            ]);
        }
    }
    let yaml_fence = Regex::new(r"(?ms)```ya?ml\s*\n(.*?)\n```").expect("valid yaml regex");
    for capture in yaml_fence.captures_iter(source) {
        if let Some(body) = capture.get(1) {
            output.push(
                "> Imported source block (not executable until its entities are modeled):".into(),
            );
            output.extend(body.as_str().lines().map(|line| format!("> {line}")));
            output.push(String::new());
        }
    }
    let counts = ImportCounts {
        user_stories: stories.len(),
        requirements: requirements.len(),
        success_criteria: success.len(),
        tasks: tasks.len(),
        entities: entities.len(),
    };
    (format!("{}\n", output.join("\n")), counts, feature_title)
}

fn markdown_artifact(title: &str, source_path: &str, content: &str) -> String {
    let quoted = content
        .trim()
        .lines()
        .map(|line| format!("> {line}"))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "# {title}\n\n> Imported from {source_path}. Edit the Spec Kit source, then re-run dotdog speckit import.\n\nImported source is quoted so it remains documentation rather than executable graph syntax.\n\n{quoted}\n"
    )
}

pub fn import(root: &Path, output_dir: Option<&Path>, force: bool) -> Result<ImportResult> {
    let root = root.canonicalize()?;
    let output_relative = output_dir.unwrap_or_else(|| Path::new(".doghouse/speckit"));
    validate_output(&root, output_relative)?;
    let output = root.join(output_relative);
    fs::create_dir_all(&output)?;
    let manifest_path = output.join("import.json");
    let previous = if manifest_path.is_file() {
        serde_json::from_slice::<Manifest>(&fs::read(&manifest_path)?)?
    } else {
        Manifest::default()
    };
    let mut manifest = Manifest {
        version: manifest_version(),
        source: manifest_source(),
        output: portable(&root, &output),
        files: BTreeMap::new(),
        features: Vec::new(),
    };
    let mut summary = ImportSummary::default();
    let mut features = Vec::new();
    let mut actions = Vec::new();
    let specs = root.join("specs");
    if specs.is_dir() {
        let mut directories = fs::read_dir(&specs)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        directories.sort();
        for feature_dir in directories {
            let spec_path = feature_dir.join("spec.md");
            if !spec_path.is_file() {
                continue;
            }
            let feature = feature_dir
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("feature")
                .to_string();
            if !feature.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
            }) {
                bail!("unsafe Spec Kit feature directory name: {feature}");
            }
            let spec_source = read_source(&root, &spec_path)?;
            let tasks_path = feature_dir.join("tasks.md");
            let tasks_source = if tasks_path.is_file() {
                read_source(&root, &tasks_path)?
            } else {
                String::new()
            };
            let (spec_dog, counts, feature_title) =
                render_spec(&feature, &spec_source, &tasks_source);
            let constitution_path = root.join(".specify/memory/constitution.md");
            let mut artifacts = BTreeMap::new();
            artifacts.insert("SPEC.dog".to_string(), spec_dog);
            artifacts.insert(
                "constitution.dog".to_string(),
                markdown_artifact(
                    "Constitution",
                    ".specify/memory/constitution.md",
                    &if constitution_path.is_file() {
                        read_source(&root, &constitution_path)?
                    } else {
                        String::new()
                    },
                ),
            );
            for (source_name, output_name, heading) in [
                ("data-model.md", "data-model.dog", "Data Model"),
                ("plan.md", "plan.dog", "Implementation Plan"),
                ("research.md", "research.dog", "Research"),
                ("quickstart.md", "quickstart.dog", "Quickstart"),
            ] {
                let path = feature_dir.join(source_name);
                artifacts.insert(
                    output_name.into(),
                    markdown_artifact(
                        heading,
                        &format!("specs/{feature}/{source_name}"),
                        &if path.is_file() {
                            read_source(&root, &path)?
                        } else {
                            String::new()
                        },
                    ),
                );
            }
            let contracts = feature_dir.join("contracts");
            let mut contract_text = String::new();
            if contracts.is_dir() {
                let mut files = fs::read_dir(&contracts)?
                    .filter_map(|entry| entry.ok())
                    .map(|entry| entry.path())
                    .filter(|path| path.is_file())
                    .collect::<Vec<_>>();
                files.sort();
                for path in files {
                    contract_text.push_str(&format!(
                        "\n## {}\n\n```\n{}\n```\n",
                        path.file_name()
                            .and_then(|value| value.to_str())
                            .unwrap_or("contract"),
                        read_source(&root, &path)?
                    ));
                }
            }
            artifacts.insert(
                "contracts.dog".into(),
                markdown_artifact(
                    "Contracts",
                    &format!("specs/{feature}/contracts"),
                    &contract_text,
                ),
            );
            let feature_output = output.join(&feature);
            if feature_output.exists()
                && fs::symlink_metadata(&feature_output)?
                    .file_type()
                    .is_symlink()
            {
                bail!(
                    "symlinked Spec Kit output path: {}",
                    feature_output.display()
                );
            }
            fs::create_dir_all(&feature_output)?;
            let artifact_names = [
                "SPEC.dog",
                "constitution.dog",
                "data-model.dog",
                "plan.dog",
                "research.dog",
                "quickstart.dog",
                "contracts.dog",
            ]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
            for name in &artifact_names {
                let content = artifacts
                    .remove(name)
                    .context("missing generated artifact")?;
                let relative = format!("{feature}/{name}");
                let path = feature_output.join(name);
                let new_hash = sha256(content.as_bytes());
                let current_hash = path
                    .is_file()
                    .then(|| fs::read(&path))
                    .transpose()?
                    .map(|bytes| sha256(&bytes));
                let managed_hash = previous.files.get(&relative);
                if current_hash.as_deref() == Some(&new_hash) {
                    summary.unchanged += 1;
                    actions.push(ImportAction {
                        path: relative.clone(),
                        status: "unchanged".into(),
                        reason: None,
                    });
                } else if path.exists()
                    && !force
                    && managed_hash.is_none_or(|hash| current_hash.as_ref() != Some(hash))
                {
                    summary.skipped += 1;
                    actions.push(ImportAction {
                        path: relative.clone(),
                        status: "skipped".into(),
                        reason: Some("local edits preserved; use --force to replace".into()),
                    });
                } else {
                    fs::write(&path, content)?;
                    summary.written += 1;
                    actions.push(ImportAction {
                        path: relative.clone(),
                        status: "written".into(),
                        reason: None,
                    });
                }
                let final_hash = if path.is_file() {
                    sha256(&fs::read(&path)?)
                } else {
                    new_hash
                };
                manifest.files.insert(relative, final_hash);
            }
            features.push(FeatureImport {
                id: feature.clone(),
                title: feature_title,
                source: format!("specs/{feature}/spec.md"),
                output: format!("{}/{feature}", portable(&root, &output)),
                artifacts: artifact_names,
                counts,
            });
        }
    }
    manifest.features = features.clone();
    fs::write(
        &manifest_path,
        format!("{}\n", serde_json::to_string_pretty(&manifest)?),
    )?;
    Ok(ImportResult {
        root: ".".into(),
        output: portable(&root, &output),
        features,
        summary,
        actions,
    })
}

pub fn format_result(result: &ImportResult) -> String {
    format!(
        "Imported {} Spec Kit feature{} into {}\n{} written, {} unchanged, {} skipped",
        result.features.len(),
        if result.features.len() == 1 { "" } else { "s" },
        result.output,
        result.summary.written,
        result.summary.unchanged,
        result.summary.skipped
    )
}

trait IfEmpty {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str;
}
impl IfEmpty for str {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str {
        if self.is_empty() { fallback } else { self }
    }
}
