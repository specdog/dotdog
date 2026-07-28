use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    pub section: String,
    pub heading: String,
    pub file: String,
    pub content: String,
    pub vector: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchIndex {
    pub version: String,
    pub project: String,
    pub built: String,
    pub entries: Vec<IndexEntry>,
    pub vocabulary: Vec<String>,
    pub df: Vec<usize>,
}

pub struct SearchResult<'a> {
    pub entry: &'a IndexEntry,
    pub score: f64,
}

fn tokens(text: &str) -> Vec<String> {
    let stop = [
        "the", "and", "for", "are", "but", "not", "you", "all", "that", "this", "with", "from",
        "they", "will", "which", "their", "there", "about", "into", "each", "other", "more",
        "only", "when", "where", "what", "then",
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    text.to_ascii_lowercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|term| term.len() > 2 && !stop.contains(term))
        .map(str::to_string)
        .collect()
}

pub fn build_index(project_dir: &Path, project: &str) -> Result<SearchIndex> {
    let mut files = fs::read_dir(project_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("dog"))
        .collect::<Vec<_>>();
    files.sort();
    let mut entries = Vec::new();
    let mut frequencies = BTreeMap::<String, usize>::new();
    for path in files {
        let source = fs::read_to_string(&path)?;
        let mut sections = Vec::<(String, String)>::new();
        let mut heading = "(root)".to_string();
        let mut body = Vec::new();
        for line in source.lines() {
            if line.starts_with("## ") {
                if !body.is_empty() {
                    sections.push((heading, body.join("\n")));
                }
                heading = line.trim_start_matches('#').trim().to_string();
                body = Vec::new();
            } else {
                body.push(line);
            }
        }
        sections.push((heading, body.join("\n")));
        for (heading, body) in sections {
            let terms = tokens(&body);
            if body.trim().len() < 20 || terms.len() < 5 {
                continue;
            }
            for term in &terms {
                *frequencies.entry(term.clone()).or_default() += 1;
            }
            entries.push(IndexEntry {
                section: heading.clone(),
                heading,
                file: path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .into(),
                content: body.chars().take(500).collect(),
                vector: Vec::new(),
            });
        }
    }
    let mut ranked = frequencies
        .iter()
        .filter(|(_, count)| **count >= 2)
        .collect::<Vec<_>>();
    ranked.sort_by(|(left_term, left_count), (right_term, right_count)| {
        right_count.cmp(left_count).then(left_term.cmp(right_term))
    });
    let vocabulary = ranked
        .into_iter()
        .take(1000)
        .map(|(term, _)| term.clone())
        .collect::<Vec<_>>();
    let df = vocabulary
        .iter()
        .map(|term| frequencies[term])
        .collect::<Vec<_>>();
    let count = entries.len() as f64;
    for entry in &mut entries {
        let terms = tokens(&entry.content);
        let mut tf = BTreeMap::<String, usize>::new();
        for term in &terms {
            *tf.entry(term.clone()).or_default() += 1;
        }
        entry.vector = vocabulary
            .iter()
            .map(|term| {
                let frequency = tf.get(term).copied().unwrap_or_default();
                if frequency == 0 || terms.is_empty() {
                    0.0
                } else {
                    (frequency as f64 / terms.len() as f64)
                        * (count / frequencies[term] as f64).ln()
                }
            })
            .collect();
    }
    Ok(SearchIndex {
        version: "1.0".into(),
        project: project.into(),
        built: SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs()
            .to_string(),
        entries,
        vocabulary,
        df,
    })
}

pub fn search_index<'a>(
    index: &'a SearchIndex,
    query: &str,
    limit: usize,
) -> Vec<SearchResult<'a>> {
    let query_terms = tokens(query).into_iter().collect::<BTreeSet<_>>();
    let query_vector = index
        .vocabulary
        .iter()
        .map(|term| f64::from(query_terms.contains(term)))
        .collect::<Vec<_>>();
    let mut results = index
        .entries
        .iter()
        .filter_map(|entry| {
            let dot = query_vector
                .iter()
                .zip(&entry.vector)
                .map(|(left, right)| left * right)
                .sum::<f64>();
            let query_magnitude = query_vector
                .iter()
                .map(|value| value * value)
                .sum::<f64>()
                .sqrt();
            let entry_magnitude = entry
                .vector
                .iter()
                .map(|value| value * value)
                .sum::<f64>()
                .sqrt();
            let score = if query_magnitude > 0.0 && entry_magnitude > 0.0 {
                dot / (query_magnitude * entry_magnitude)
            } else {
                0.0
            };
            (score > 0.0).then_some(SearchResult { entry, score })
        })
        .collect::<Vec<_>>();
    results.sort_by(|left, right| right.score.total_cmp(&left.score));
    results.truncate(limit);
    results
}
