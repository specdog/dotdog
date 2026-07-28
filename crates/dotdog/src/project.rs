use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Project {
    pub root_name: String,
    pub name: String,
    pub path: PathBuf,
    pub dog_files: Vec<PathBuf>,
}

pub fn discover_projects(root: &Path) -> Result<Vec<Project>> {
    let mut projects = Vec::new();
    for root_name in ["projects", "specs"] {
        let base = root.join(root_name);
        if !base.is_dir() {
            continue;
        }
        let mut entries = fs::read_dir(&base)
            .with_context(|| format!("failed to read {}", base.display()))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let path = entry.path();
            if !path.join("SPEC.dog").is_file() {
                continue;
            }
            let mut dog_files = fs::read_dir(&path)?
                .filter_map(|item| item.ok())
                .map(|item| item.path())
                .filter(|file| file.extension().and_then(|value| value.to_str()) == Some("dog"))
                .collect::<Vec<_>>();
            dog_files.sort();
            projects.push(Project {
                root_name: root_name.to_string(),
                name: entry.file_name().to_string_lossy().to_string(),
                path,
                dog_files,
            });
        }
    }

    if root.join("SPEC.dog").is_file() {
        let mut dog_files = fs::read_dir(root)?
            .filter_map(|item| item.ok())
            .map(|item| item.path())
            .filter(|file| file.extension().and_then(|value| value.to_str()) == Some("dog"))
            .collect::<Vec<_>>();
        dog_files.sort();
        projects.push(Project {
            root_name: ".".to_string(),
            name: root
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("project")
                .to_string(),
            path: root.to_path_buf(),
            dog_files,
        });
    }

    Ok(projects)
}

pub fn project_names(root: &Path) -> Result<Vec<String>> {
    Ok(discover_projects(root)?
        .into_iter()
        .map(|project| project.name)
        .collect())
}
