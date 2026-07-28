use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use regex::Regex;
use reqwest::StatusCode;
use reqwest::blocking::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use anyhow::Result;

use crate::grammar::BlockNode;
use crate::parser::parse;
use crate::project::discover_projects;
use crate::workspace::redact_secrets;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InfraResource {
    pub provider: String,
    pub resource: String,
    pub entity: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tables: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CheckResult {
    pub entity: String,
    pub provider: String,
    pub resource: String,
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl CheckResult {
    fn new(resource: &InfraResource, status: &str, message: impl Into<String>) -> Self {
        Self {
            entity: resource.entity.clone(),
            provider: resource.provider.clone(),
            resource: resource.resource.clone(),
            status: status.into(),
            message: message.into(),
            detail: None,
        }
    }
}

fn parts(resource: &InfraResource) -> Option<(&str, &str)> {
    resource.resource.split_once(':')
}

fn client(timeout: u64) -> Result<Client, reqwest::Error> {
    Client::builder()
        .timeout(Duration::from_secs(timeout.clamp(1, 120)))
        .user_agent(concat!("dotdog/", env!("CARGO_PKG_VERSION")))
        .build()
}

fn response_detail(response: Response) -> Option<String> {
    response.json::<Value>().ok().map(|value| {
        redact_secrets(&value.to_string())
            .chars()
            .take(240)
            .collect()
    })
}

fn http_result(
    resource: &InfraResource,
    response: Result<Response, reqwest::Error>,
) -> CheckResult {
    match response {
        Ok(response) if response.status().is_success() => {
            let detail = response_detail(response);
            let mut result = CheckResult::new(resource, "pass", "exists");
            result.detail = detail;
            result
        }
        Ok(response) if response.status() == StatusCode::NOT_FOUND => {
            CheckResult::new(resource, "fail", "not found")
        }
        Ok(response) => CheckResult::new(resource, "warn", format!("HTTP {}", response.status())),
        Err(error) => CheckResult::new(resource, "warn", format!("request failed: {error}")),
    }
}

fn url(base: &str, segments: &[&str]) -> Result<reqwest::Url, String> {
    let mut value = reqwest::Url::parse(base).map_err(|error| error.to_string())?;
    value
        .path_segments_mut()
        .map_err(|_| "URL cannot contain path segments".to_string())?
        .extend(segments);
    Ok(value)
}

fn bearer_get(
    resource: &InfraResource,
    timeout: u64,
    token_name: &str,
    base: &str,
    segments: &[&str],
) -> CheckResult {
    let Ok(token) = std::env::var(token_name) else {
        return CheckResult::new(resource, "skip", format!("{token_name} not set"));
    };
    let endpoint = match url(base, segments) {
        Ok(endpoint) => endpoint,
        Err(error) => return CheckResult::new(resource, "fail", error),
    };
    let client = match client(timeout) {
        Ok(client) => client,
        Err(error) => return CheckResult::new(resource, "warn", error.to_string()),
    };
    http_result(resource, client.get(endpoint).bearer_auth(token).send())
}

fn verify_vercel(resource: &InfraResource, timeout: u64) -> CheckResult {
    let Some((kind, name)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected project:name or deployment:id");
    };
    let segments = match kind {
        "project" => vec!["v9", "projects", name],
        "deployment" => vec!["v13", "deployments", name],
        _ => return CheckResult::new(resource, "fail", format!("unknown resource type: {kind}")),
    };
    bearer_get(
        resource,
        timeout,
        "VERCEL_TOKEN",
        "https://api.vercel.com/",
        &segments,
    )
}

fn verify_netlify(resource: &InfraResource, timeout: u64) -> CheckResult {
    let Some((kind, name)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected site:name or deploy:id");
    };
    let segment = match kind {
        "site" => "sites",
        "deploy" => "deploys",
        _ => return CheckResult::new(resource, "fail", format!("unknown resource type: {kind}")),
    };
    bearer_get(
        resource,
        timeout,
        "NETLIFY_AUTH_TOKEN",
        "https://api.netlify.com/api/v1/",
        &[segment, name],
    )
}

fn verify_supabase(resource: &InfraResource, timeout: u64) -> CheckResult {
    let Some((kind, project_ref)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected project:ref");
    };
    if kind != "project" {
        return CheckResult::new(resource, "fail", "expected project:ref");
    }
    let Ok(token) = std::env::var("SUPABASE_ACCESS_TOKEN") else {
        return CheckResult::new(resource, "skip", "SUPABASE_ACCESS_TOKEN not set");
    };
    let client = match client(timeout) {
        Ok(client) => client,
        Err(error) => return CheckResult::new(resource, "warn", error.to_string()),
    };
    match client
        .get("https://api.supabase.com/v1/projects")
        .bearer_auth(token)
        .send()
    {
        Ok(response) if response.status().is_success() => {
            let projects = response.json::<Vec<Value>>().unwrap_or_default();
            if projects.iter().any(|project| {
                project
                    .get("id")
                    .or_else(|| project.get("ref"))
                    .and_then(Value::as_str)
                    == Some(project_ref)
            }) {
                CheckResult::new(resource, "pass", "exists")
            } else {
                CheckResult::new(resource, "fail", "project not found")
            }
        }
        Ok(response) => CheckResult::new(resource, "warn", format!("HTTP {}", response.status())),
        Err(error) => CheckResult::new(resource, "warn", format!("request failed: {error}")),
    }
}

fn verify_railway(resource: &InfraResource, timeout: u64) -> CheckResult {
    let Some((kind, name)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected service:name");
    };
    if kind != "service" {
        return CheckResult::new(resource, "fail", "expected service:name");
    }
    let Ok(token) = std::env::var("RAILWAY_TOKEN") else {
        return CheckResult::new(resource, "skip", "RAILWAY_TOKEN not set");
    };
    let client = match client(timeout) {
        Ok(client) => client,
        Err(error) => return CheckResult::new(resource, "warn", error.to_string()),
    };
    let query_name = serde_json::to_string(name).unwrap_or_else(|_| "\"\"".into());
    let response = client
        .post("https://backboard.railway.app/graphql")
        .bearer_auth(token)
        .json(&json!({"query":format!("{{ service(name: {query_name}) {{ id name status }} }}")}))
        .send();
    match response {
        Ok(response) if response.status().is_success() => {
            let value = response.json::<Value>().unwrap_or(Value::Null);
            if value
                .pointer("/data/service")
                .is_some_and(|value| !value.is_null())
            {
                CheckResult::new(resource, "pass", "exists")
            } else {
                CheckResult::new(resource, "fail", "service not found")
            }
        }
        other => http_result(resource, other),
    }
}

fn verify_cloudflare(resource: &InfraResource, timeout: u64) -> CheckResult {
    let Some((kind, name)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected type:name");
    };
    let token =
        std::env::var("CLOUDFLARE_API_TOKEN").or_else(|_| std::env::var("CLOUDFLARE_API_KEY"));
    let Ok(token) = token else {
        return CheckResult::new(resource, "skip", "CLOUDFLARE_API_TOKEN not set");
    };
    let Ok(account) = std::env::var("CLOUDFLARE_ACCOUNT_ID") else {
        return CheckResult::new(resource, "skip", "CLOUDFLARE_ACCOUNT_ID not set");
    };
    let segments = match kind {
        "r2" => vec!["client", "v4", "accounts", &account, "r2", "buckets", name],
        "d1" => vec!["client", "v4", "accounts", &account, "d1", "database", name],
        "worker" => vec![
            "client", "v4", "accounts", &account, "workers", "scripts", name,
        ],
        "kv" => vec![
            "client",
            "v4",
            "accounts",
            &account,
            "storage",
            "kv",
            "namespaces",
            name,
        ],
        _ => return CheckResult::new(resource, "fail", format!("unknown resource type: {kind}")),
    };
    let endpoint = match url("https://api.cloudflare.com/", &segments) {
        Ok(endpoint) => endpoint,
        Err(error) => return CheckResult::new(resource, "fail", error),
    };
    let client = match client(timeout) {
        Ok(client) => client,
        Err(error) => return CheckResult::new(resource, "warn", error.to_string()),
    };
    http_result(resource, client.get(endpoint).bearer_auth(token).send())
}

fn aws_output(args: &[String]) -> std::io::Result<std::process::Output> {
    let mut command = Command::new("aws");
    command
        .args(args)
        .args(["--no-cli-pager", "--output", "json"]);
    command.env_clear();
    for key in [
        "PATH",
        "AWS_PROFILE",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
    ] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    command.output()
}

fn verify_aws(resource: &InfraResource) -> CheckResult {
    let Some((kind, name)) = parts(resource) else {
        return CheckResult::new(resource, "fail", "expected type:name");
    };
    let mut args = match kind {
        "s3" => vec!["s3api", "head-bucket", "--bucket", name],
        "lambda" => vec!["lambda", "get-function", "--function-name", name],
        "rds" => vec![
            "rds",
            "describe-db-instances",
            "--db-instance-identifier",
            name,
        ],
        "dynamodb" => vec!["dynamodb", "describe-table", "--table-name", name],
        _ => return CheckResult::new(resource, "fail", format!("unknown resource type: {kind}")),
    }
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<_>>();
    if let Some(region) = &resource.region {
        args.extend(["--region".into(), region.clone()]);
    }
    match aws_output(&args) {
        Ok(output) if output.status.success() => CheckResult::new(resource, "pass", "exists"),
        Ok(output) => {
            let message = redact_secrets(&String::from_utf8_lossy(&output.stderr));
            let message = message.lines().next().unwrap_or("AWS check failed");
            if message.contains("NotFound") || message.to_ascii_lowercase().contains("not found") {
                CheckResult::new(resource, "fail", "not found")
            } else {
                CheckResult::new(
                    resource,
                    "warn",
                    message.chars().take(160).collect::<String>(),
                )
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            CheckResult::new(resource, "skip", "aws CLI not installed")
        }
        Err(error) => CheckResult::new(resource, "warn", error.to_string()),
    }
}

pub fn verify(resource: &InfraResource, timeout: u64) -> CheckResult {
    match resource.provider.to_ascii_lowercase().as_str() {
        "aws" => verify_aws(resource),
        "cloudflare" => verify_cloudflare(resource, timeout),
        "netlify" => verify_netlify(resource, timeout),
        "railway" => verify_railway(resource, timeout),
        "supabase" => verify_supabase(resource, timeout),
        "vercel" => verify_vercel(resource, timeout),
        provider => CheckResult::new(resource, "skip", format!("unknown provider: {provider}")),
    }
}

pub fn verify_all(resources: &[InfraResource], timeout: u64) -> Vec<CheckResult> {
    resources
        .iter()
        .map(|resource| verify(resource, timeout))
        .collect()
}

pub fn resource_from_properties(
    entity: &str,
    properties: &BTreeMap<String, Value>,
) -> Option<InfraResource> {
    let text = |key: &str| {
        properties
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    Some(InfraResource {
        provider: text("provider")?,
        resource: text("resource")?,
        entity: entity.into(),
        region: text("region"),
        tables: properties
            .get("tables")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
    })
}

fn resources_from_yaml(source: &str) -> Vec<InfraResource> {
    let Ok(value) = serde_yaml_ng::from_str::<Value>(source) else {
        return Vec::new();
    };
    value
        .get("resources")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let text = |key: &str| item.get(key).and_then(Value::as_str).map(str::to_string);
            Some(InfraResource {
                provider: text("provider")?,
                resource: text("resource")?,
                entity: text("entity")?,
                region: text("region"),
                tables: item
                    .get("tables")
                    .and_then(Value::as_array)
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(Value::as_str)
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default(),
            })
        })
        .collect()
}

pub fn find_resources(root: &Path) -> Result<Vec<InfraResource>> {
    let fence = Regex::new(r"(?s)```(?:yaml|yml)?\s*\n(.*?)```").expect("valid fence regex");
    let mut resources = BTreeMap::new();
    for project in discover_projects(root)? {
        for file in project.dog_files {
            let document = parse(&fs::read_to_string(file)?);
            for section in document.sections {
                let infrastructure_section = section
                    .heading
                    .to_ascii_lowercase()
                    .contains("infrastructure");
                for block in section.blocks {
                    match block {
                        BlockNode::Entity {
                            name,
                            entity_type,
                            properties,
                            ..
                        } if matches!(entity_type.as_str(), "infra" | "infrastructure") => {
                            let values = properties
                                .into_iter()
                                .filter_map(|(key, property)| {
                                    property.default.map(|value| (key, value))
                                })
                                .collect::<BTreeMap<_, _>>();
                            if let Some(resource) = resource_from_properties(&name, &values) {
                                resources.insert(
                                    format!(
                                        "{}:{}:{}",
                                        resource.provider, resource.resource, resource.entity
                                    ),
                                    resource,
                                );
                            }
                        }
                        BlockNode::Prose { content, .. } if infrastructure_section => {
                            let mut found = false;
                            for capture in fence.captures_iter(&content) {
                                if let Some(body) = capture.get(1) {
                                    found = true;
                                    for resource in resources_from_yaml(body.as_str()) {
                                        resources.insert(
                                            format!(
                                                "{}:{}:{}",
                                                resource.provider,
                                                resource.resource,
                                                resource.entity
                                            ),
                                            resource,
                                        );
                                    }
                                }
                            }
                            if !found && content.contains("resources:") {
                                for resource in resources_from_yaml(&content) {
                                    resources.insert(
                                        format!(
                                            "{}:{}:{}",
                                            resource.provider, resource.resource, resource.entity
                                        ),
                                        resource,
                                    );
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    Ok(resources.into_values().collect())
}

#[cfg(test)]
mod tests {
    use super::{InfraResource, resources_from_yaml, verify};

    #[test]
    fn missing_credentials_skip_without_network_access() {
        let resource = InfraResource {
            provider: "vercel".into(),
            resource: "project:example".into(),
            entity: "WebApp".into(),
            region: None,
            tables: Vec::new(),
        };
        if std::env::var_os("VERCEL_TOKEN").is_none() {
            assert_eq!(verify(&resource, 1).status, "skip");
        }
    }

    #[test]
    fn unknown_provider_is_explicitly_skipped() {
        let resource = InfraResource {
            provider: "unknown".into(),
            resource: "thing:name".into(),
            entity: "Thing".into(),
            region: None,
            tables: Vec::new(),
        };
        assert_eq!(verify(&resource, 1).message, "unknown provider: unknown");
    }

    #[test]
    fn parses_resource_lists_from_infrastructure_yaml() {
        let resources = resources_from_yaml(
            "resources:\n  - provider: supabase\n    resource: project:example\n    entity: Database\n    tables: [users, sessions]\n",
        );
        assert_eq!(resources.len(), 1);
        assert_eq!(resources[0].entity, "Database");
        assert_eq!(resources[0].tables, ["users", "sessions"]);
    }
}
