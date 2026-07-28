use std::collections::BTreeMap;

use regex::Regex;
use serde_json::{Map, Number, Value};

use crate::grammar::{Block, Document, ParseError, PropertyDef, Section, YamlMap};

pub fn parse(source: &str) -> Document {
    let lines: Vec<&str> = source.split('\n').collect();
    let mut errors = Vec::new();
    let sections = parse_sections(&lines, &mut errors);
    Document {
        kind: "document".into(),
        sections,
        errors,
    }
}

pub fn parse_to_json(source: &str) -> String {
    serde_json::to_string_pretty(&parse(source)).expect("AST is serializable")
}

fn parse_sections(lines: &[&str], errors: &mut Vec<ParseError>) -> Vec<Section> {
    let mut sections = Vec::new();
    let first_heading = lines
        .iter()
        .position(|line| line.starts_with("## "))
        .unwrap_or(lines.len());
    let root_blocks = parse_blocks(lines, 0, first_heading, errors);
    if !root_blocks.is_empty() {
        sections.push(Section {
            kind: "section".into(),
            level: 1,
            heading: "(root)".into(),
            blocks: root_blocks,
            line_start: 1,
            line_end: lines.len(),
        });
    }

    let mut i = 0;
    while i < lines.len() {
        if let Some((level, heading)) = section_heading(lines[i]) {
            let start = i;
            i += 1;
            let end = (i..lines.len())
                .find(|&index| section_heading(lines[index]).is_some())
                .unwrap_or(lines.len());
            sections.push(Section {
                kind: "section".into(),
                level,
                heading,
                blocks: parse_blocks(lines, start, end, errors),
                line_start: start + 1,
                line_end: end + 1,
            });
            i = end;
        } else {
            i += 1;
        }
    }
    sections
}

fn section_heading(line: &str) -> Option<(u8, String)> {
    if let Some(value) = line.strip_prefix("### ") {
        Some((3, value.to_string()))
    } else {
        line.strip_prefix("## ").map(|value| (2, value.to_string()))
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum StructuredKind {
    Entity,
    Relationship,
    Event,
    Endpoint,
    Prediction,
}

fn structured_heading(line: &str) -> Option<(StructuredKind, String)> {
    let re = Regex::new(r"^#{2,5}\s+([^:]+):\s*(.+)$").expect("valid regex");
    let captures = re.captures(line)?;
    let label = captures.get(1)?.as_str();
    let rest = captures.get(2)?.as_str().to_string();
    let kind = match label.to_ascii_lowercase().as_str() {
        "entity" => StructuredKind::Entity,
        "relationship" => StructuredKind::Relationship,
        "event" => StructuredKind::Event,
        "endpoint" => StructuredKind::Endpoint,
        "prediction" => StructuredKind::Prediction,
        _ => return None,
    };
    Some((kind, rest))
}

fn is_block_start(line: &str) -> bool {
    structured_heading(line).is_some()
        || (line.starts_with('|') && line.ends_with('|'))
        || (line.starts_with('[') && line.ends_with(']'))
}

fn parse_blocks(
    lines: &[&str],
    start: usize,
    end: usize,
    errors: &mut Vec<ParseError>,
) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut i = start;
    while i < end {
        if let Some((kind, rest)) = structured_heading(lines[i]) {
            let (node, next) = parse_structured_block(lines, i, end, kind, &rest, errors);
            blocks.push(node);
            i = next.max(i + 1);
            continue;
        }

        if lines[i].starts_with("```") {
            let fence_end = find_fence_end(lines, i, end);
            if fence_end < end {
                let yaml = parse_simple_yaml(&lines[i + 1..fence_end]);
                match yaml {
                    Ok(yaml) => {
                        if let Some(mut structured) = blocks_from_yaml(&yaml, i + 1, fence_end) {
                            blocks.append(&mut structured);
                            i = fence_end + 1;
                            continue;
                        }
                    }
                    Err(message) => errors.push(ParseError {
                        message: format!("YAML parse error: {message}"),
                        line: Some(i + 1),
                        context: Some(
                            lines
                                .get(i.wrapping_sub(1))
                                .copied()
                                .unwrap_or("(unknown)")
                                .trim()
                                .to_string(),
                        ),
                    }),
                }
            }
        }

        if is_table_start(lines, i, end) {
            let (table, next) = parse_table(lines, i, end);
            blocks.push(table);
            i = next;
            continue;
        }

        if is_compact_header(lines[i]) {
            let (node, next) = parse_compact_block(lines, i, end);
            blocks.push(node);
            i = next.max(i + 1);
            continue;
        }

        if lines[i].starts_with("```") {
            let fence_end = find_fence_end(lines, i, end);
            let block_end = if fence_end < end { fence_end + 1 } else { end };
            blocks.push(Block::Prose {
                content: lines[i..block_end].join("\n").trim().to_string(),
                line_start: i + 1,
                line_end: block_end,
            });
            i = block_end;
            continue;
        }

        let prose_start = i;
        while i < end && !is_block_start(lines[i]) && !lines[i].starts_with("```") {
            i += 1;
        }
        let mut prose_lines: Vec<&str> = lines[prose_start..i].to_vec();
        if prose_lines.len() != 1 {
            while prose_lines
                .first()
                .is_some_and(|line| line.trim().is_empty())
            {
                prose_lines.remove(0);
            }
            while prose_lines
                .last()
                .is_some_and(|line| line.trim().is_empty())
            {
                prose_lines.pop();
            }
        }
        if !prose_lines.is_empty() {
            blocks.push(Block::Prose {
                content: prose_lines.join("\n").trim().to_string(),
                line_start: prose_start + 1,
                line_end: i,
            });
        }
        if i == prose_start {
            i += 1;
        }
    }
    blocks
}

fn find_fence_end(lines: &[&str], start: usize, end: usize) -> usize {
    (start + 1..end)
        .find(|&index| lines[index].starts_with("```"))
        .unwrap_or(end)
}

fn parse_structured_block(
    lines: &[&str],
    start: usize,
    end: usize,
    kind: StructuredKind,
    header: &str,
    errors: &mut Vec<ParseError>,
) -> (Block, usize) {
    let mut i = start + 1;
    let mut description = Vec::new();
    while i < end && !lines[i].starts_with("```") && !is_block_start(lines[i]) {
        let trimmed = lines[i].trim();
        if !trimmed.is_empty() {
            description.push(trimmed);
        }
        i += 1;
    }
    let description = description.join(" ");

    if i >= end || !lines[i].starts_with("```") {
        return (
            Block::Entity {
                name: header.to_string(),
                description,
                entity_type: "entity".into(),
                properties: BTreeMap::new(),
                states: Vec::new(),
                lifecycle: Vec::new(),
                yaml: BTreeMap::new(),
                line_start: start + 1,
                line_end: i,
            },
            i,
        );
    }

    let fence_end = find_fence_end(lines, i, end);
    let yaml = match parse_simple_yaml(&lines[i + 1..fence_end]) {
        Ok(value) => value,
        Err(message) => {
            errors.push(ParseError {
                message: format!("YAML parse error: {message}"),
                line: Some(start + 1),
                context: Some(header.to_string()),
            });
            BTreeMap::new()
        }
    };
    let next = if fence_end < end { fence_end + 1 } else { end };
    let block = match kind {
        StructuredKind::Entity => build_entity(header, &description, yaml, start + 1, next),
        StructuredKind::Relationship => {
            build_relationship(header, &description, yaml, start + 1, next)
        }
        StructuredKind::Event => build_event(header, yaml, start + 1, next),
        StructuredKind::Endpoint => build_endpoint(header, yaml, start + 1, next),
        StructuredKind::Prediction => build_prediction(header, &description, yaml, start, next),
    };
    (block, next)
}

fn blocks_from_yaml(yaml: &YamlMap, line_start: usize, line_end: usize) -> Option<Vec<Block>> {
    if yaml.contains_key("prediction") {
        return Some(vec![build_prediction(
            string_value(yaml.get("prediction")).as_str(),
            string_value(yaml.get("description")).as_str(),
            yaml.clone(),
            line_start,
            line_end,
        )]);
    }
    if yaml.contains_key("entity") {
        return Some(vec![build_entity(
            string_value(yaml.get("entity")).as_str(),
            string_value(yaml.get("description")).as_str(),
            yaml.clone(),
            line_start,
            line_end,
        )]);
    }
    if yaml.contains_key("event") {
        return Some(vec![build_event(
            string_value(yaml.get("event")).as_str(),
            yaml.clone(),
            line_start,
            line_end,
        )]);
    }
    if yaml.contains_key("relationship") || yaml.contains_key("verb") {
        let header = match (yaml.get("source"), yaml.get("target")) {
            (Some(source), Some(target)) => {
                format!(
                    "{} → {}",
                    string_value(Some(source)),
                    string_value(Some(target))
                )
            }
            _ => string_value(yaml.get("relationship")),
        };
        return Some(vec![build_relationship(
            &header,
            string_value(yaml.get("description")).as_str(),
            yaml.clone(),
            line_start,
            line_end,
        )]);
    }
    if let Some(Value::Array(items)) = yaml.get("relationships") {
        let mut result = Vec::new();
        for item in items {
            let Some(object) = item.as_object() else {
                continue;
            };
            let map: YamlMap = object.clone().into_iter().collect();
            let source = string_value(map.get("from").or_else(|| map.get("source")));
            let target = string_value(map.get("to").or_else(|| map.get("target")));
            result.push(build_relationship(
                &format!("{source} → {target}"),
                string_value(map.get("description")).as_str(),
                map,
                line_start,
                line_end,
            ));
        }
        return Some(result);
    }
    None
}

fn build_entity(
    name: &str,
    description: &str,
    yaml: YamlMap,
    line_start: usize,
    line_end: usize,
) -> Block {
    let mut properties = BTreeMap::new();
    if let Some(Value::Object(raw)) = yaml.get("properties") {
        for (key, value) in raw {
            let resolved = if let Some(text) = value.as_str() {
                parse_inline_object(text)
                    .map(Value::Object)
                    .unwrap_or_else(|| value.clone())
            } else {
                value.clone()
            };
            if let Some(object) = resolved.as_object() {
                properties.insert(
                    key.clone(),
                    PropertyDef {
                        property_type: string_value(object.get("type")).if_empty("string"),
                        required: object
                            .get("required")
                            .and_then(Value::as_bool)
                            .unwrap_or(true),
                        default: object.get("default").cloned(),
                        constraints: object
                            .get("constraints")
                            .map(|value| string_value(Some(value))),
                        example: object.get("example").map(|value| string_value(Some(value))),
                    },
                );
            }
        }
    }
    let states = string_array(yaml.get("states"));
    let lifecycle_parts: Vec<String> = string_value(yaml.get("lifecycle"))
        .split('→')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect();
    let lifecycle = lifecycle_parts
        .windows(2)
        .map(|pair| format!("{} → {}", pair[0], pair[1]))
        .collect();
    Block::Entity {
        name: name.to_string(),
        description: if description.is_empty() {
            string_value(yaml.get("description"))
        } else {
            description.to_string()
        },
        entity_type: string_value(yaml.get("type")).if_empty("node"),
        properties,
        states,
        lifecycle,
        yaml,
        line_start,
        line_end,
    }
}

fn build_relationship(
    header: &str,
    description: &str,
    yaml: YamlMap,
    line_start: usize,
    line_end: usize,
) -> Block {
    let mut parts = header.split('→').map(str::trim);
    let source = parts
        .next()
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| string_value(yaml.get("source")));
    let target = parts
        .next()
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| string_value(yaml.get("target")));
    let invariants = match yaml.get("invariants") {
        Some(Value::Array(_)) => string_array(yaml.get("invariants")),
        Some(value) => vec![string_value(Some(value))],
        None => vec![String::new()],
    };
    Block::Relationship {
        source,
        target,
        verb: string_value(yaml.get("verb")).if_empty("connects"),
        description: if description.is_empty() {
            string_value(yaml.get("description"))
        } else {
            description.to_string()
        },
        cardinality: string_value(yaml.get("cardinality")).if_empty("N:M"),
        required: yaml
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        cascade: string_value(yaml.get("cascade")).if_empty("none"),
        invariants,
        yaml,
        line_start,
        line_end,
    }
}

fn build_event(name: &str, yaml: YamlMap, line_start: usize, line_end: usize) -> Block {
    let payload = yaml
        .get("payload")
        .and_then(Value::as_object)
        .map(|object| {
            object
                .iter()
                .map(|(key, value)| (key.clone(), string_value(Some(value))))
                .collect()
        })
        .unwrap_or_default();
    Block::Event {
        name: name.to_string(),
        trigger: string_value(yaml.get("trigger")),
        payload,
        preconditions: string_array(yaml.get("preconditions")),
        postconditions: string_array(yaml.get("postconditions")),
        side_effects: string_array(yaml.get("sideEffects")),
        probability: yaml.get("probability").and_then(Value::as_f64),
        yaml,
        line_start,
        line_end,
    }
}

fn build_prediction(
    name: &str,
    description: &str,
    yaml: YamlMap,
    line_start: usize,
    line_end: usize,
) -> Block {
    Block::Prediction {
        statement: name.to_string(),
        description: description.to_string(),
        trigger: string_value(yaml.get("trigger")),
        timeframe: string_value(yaml.get("timeframe")),
        confidence: yaml
            .get("confidence")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        measurement: string_value(yaml.get("measurement")),
        status: string_value(yaml.get("status")).if_empty("pending"),
        yaml,
        line_start,
        line_end,
    }
}

fn build_endpoint(name: &str, yaml: YamlMap, line_start: usize, line_end: usize) -> Block {
    Block::Endpoint {
        name: name.to_string(),
        url: string_value(yaml.get("url")),
        backup_url: yaml
            .get("backup_url")
            .map(|value| string_value(Some(value)))
            .filter(|value| !value.is_empty()),
        method: string_value(yaml.get("method")).if_empty("GET"),
        expect_status: yaml
            .get("expect_status")
            .and_then(Value::as_u64)
            .unwrap_or(200) as u16,
        expect_body: yaml.get("expect_body").cloned(),
        timeout: yaml.get("timeout").and_then(Value::as_u64).unwrap_or(10),
        yaml,
        line_start,
        line_end,
    }
}

fn is_table_start(lines: &[&str], index: usize, end: usize) -> bool {
    index + 1 < end
        && lines[index].starts_with('|')
        && lines[index].ends_with('|')
        && lines[index + 1].starts_with('|')
        && lines[index + 1]
            .chars()
            .all(|character| matches!(character, '|' | '-' | ' ' | ':'))
}

fn parse_table(lines: &[&str], start: usize, end: usize) -> (Block, usize) {
    let headers = split_table_row(lines[start]);
    let mut rows = Vec::new();
    let mut i = start + 2;
    while i < end && lines[i].starts_with('|') {
        rows.push(split_table_row(lines[i]));
        i += 1;
    }
    (
        Block::Table {
            headers,
            rows,
            line_start: start + 1,
            line_end: i,
        },
        i,
    )
}

fn split_table_row(line: &str) -> Vec<String> {
    line.split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect()
}

fn is_compact_header(line: &str) -> bool {
    line.starts_with('[') && line.ends_with(']') && line.len() > 2
}

fn parse_compact_block(lines: &[&str], start: usize, end: usize) -> (Block, usize) {
    let name = lines[start]
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim()
        .to_string();
    let compact = Regex::new(r"^(\w[\w_]*)\s*→\s*(.+?)(?:\((\w+)\))?\s*$").expect("valid regex");
    let mut i = start + 1;
    let mut props = Vec::new();
    let mut prose = Vec::new();
    while i < end {
        let line = lines[i];
        if is_compact_header(line)
            || line.starts_with('#')
            || line.starts_with('|')
            || line.starts_with("```")
        {
            break;
        }
        if let Some(captures) = compact.captures(line) {
            props.push((captures[1].to_string(), captures[2].trim().to_string()));
        } else if !line.trim().is_empty() {
            prose.push(line.trim().to_string());
        }
        i += 1;
    }
    let description = props
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("desc"))
        .map(|(_, value)| value.clone())
        .unwrap_or_else(|| prose.join(" "));
    let states = props
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("flow"))
        .map(|(_, value)| {
            value
                .split('→')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let lifecycle = states
        .windows(2)
        .map(|pair| format!("{} → {}", pair[0], pair[1]))
        .collect();
    let yaml = props
        .into_iter()
        .filter(|(key, _)| !key.eq_ignore_ascii_case("desc"))
        .map(|(key, value)| (key, Value::String(value)))
        .collect();
    (
        Block::Entity {
            name,
            description,
            entity_type: "entity".into(),
            properties: BTreeMap::new(),
            states,
            lifecycle,
            yaml,
            line_start: start + 1,
            line_end: i,
        },
        i,
    )
}

pub fn parse_simple_yaml(lines: &[&str]) -> Result<YamlMap, String> {
    let mut result = YamlMap::new();
    let mut current_key: Option<String> = None;
    let mut current_object = Map::new();
    let mut current_nested: Option<String> = None;

    fn flush(
        result: &mut YamlMap,
        current_key: &mut Option<String>,
        current_object: &mut Map<String, Value>,
    ) {
        if let Some(key) = current_key.take() {
            if let Some(list) = current_object.remove("__list") {
                result.insert(key, list);
            } else {
                result.insert(key, Value::Object(std::mem::take(current_object)));
            }
        }
    }

    for raw in lines {
        let line = raw.trim_end();
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        let trimmed = line.trim_start();

        if indent == 0 {
            flush(&mut result, &mut current_key, &mut current_object);
            let Some((key, value)) = trimmed.split_once(':') else {
                return Err(format!("invalid mapping line: {line}"));
            };
            let key = key.trim().to_string();
            let value = value.trim();
            if value.is_empty() {
                current_key = Some(key);
                current_object = Map::new();
                current_nested = None;
            } else {
                result.insert(key, parse_scalar(value));
            }
            continue;
        }

        if indent == 2 && trimmed.starts_with('-') {
            let Some(_) = current_key else {
                continue;
            };
            let item = trimmed.trim_start_matches('-').trim();
            let list = current_object
                .entry("__list")
                .or_insert_with(|| Value::Array(Vec::new()));
            if let Value::Array(items) = list {
                items.push(
                    parse_inline_object(item)
                        .map(Value::Object)
                        .unwrap_or_else(|| parse_scalar(item)),
                );
            }
            continue;
        }

        if indent == 2 {
            let Some((key, value)) = trimmed.split_once(':') else {
                continue;
            };
            let key = key.trim().to_string();
            let value = value.trim();
            current_nested = Some(key.clone());
            if value.is_empty() || value == "{" {
                current_object.insert(key, Value::Object(Map::new()));
            } else {
                current_object.insert(key, parse_scalar(value));
            }
            continue;
        }

        if indent >= 4 {
            let Some(nested_key) = current_nested.clone() else {
                continue;
            };
            let Some((key, value)) = trimmed.split_once(':') else {
                continue;
            };
            let nested = current_object
                .entry(nested_key)
                .or_insert_with(|| Value::Object(Map::new()));
            if let Value::Object(object) = nested {
                object.insert(key.trim().to_string(), parse_scalar(value.trim()));
            }
        }
    }
    flush(&mut result, &mut current_key, &mut current_object);
    Ok(result)
}

fn parse_scalar(value: &str) -> Value {
    let value = value.trim();
    if value.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if value.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    if value.eq_ignore_ascii_case("null") {
        return Value::Null;
    }
    if let Ok(integer) = value.parse::<i64>() {
        return Value::Number(Number::from(integer));
    }
    if let Ok(float) = value.parse::<f64>() {
        if let Some(number) = Number::from_f64(float) {
            return Value::Number(number);
        }
    }
    if value.starts_with('[') && value.ends_with(']') {
        return Value::Array(
            value[1..value.len() - 1]
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(parse_scalar)
                .collect(),
        );
    }
    if let Some(object) = parse_inline_object(value) {
        return Value::Object(object);
    }
    Value::String(
        value
            .strip_prefix('"')
            .and_then(|value| value.strip_suffix('"'))
            .or_else(|| {
                value
                    .strip_prefix('\'')
                    .and_then(|value| value.strip_suffix('\''))
            })
            .unwrap_or(value)
            .to_string(),
    )
}

fn parse_inline_object(value: &str) -> Option<Map<String, Value>> {
    let body = value.strip_prefix('{')?.strip_suffix('}')?;
    let mut object = Map::new();
    for pair in body.split(',') {
        let (key, value) = pair.split_once(':')?;
        object.insert(key.trim().to_string(), parse_scalar(value.trim()));
    }
    Some(object)
}

fn string_array(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .map(|value| string_value(Some(value)))
            .filter(|value| !value.is_empty())
            .collect(),
        Some(value) => vec![string_value(Some(value))],
        None => Vec::new(),
    }
}

fn string_value(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Number(value)) => value.to_string(),
        Some(Value::Bool(value)) => value.to_string(),
        Some(Value::Null) | None => String::new(),
        Some(value) => value.to_string(),
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
    use super::*;

    #[test]
    fn parses_entity_and_relationship() {
        let source = "## Data Model\n\n### Entity: User\n\nA user.\n\n```yaml\nentity: User\ntype: entity\nproperties:\n  email:\n    type: string\n    required: true\nstates: [active, suspended]\nlifecycle: active → suspended\n```\n\n### Relationship: User → Session\n```yaml\nverb: owns\n```";
        let ast = parse(source);
        let entity = ast
            .sections
            .iter()
            .flat_map(|section| &section.blocks)
            .find(|block| matches!(block, Block::Entity { .. }))
            .expect("entity");
        match entity {
            Block::Entity {
                name,
                properties,
                states,
                ..
            } => {
                assert_eq!(name, "User");
                assert!(properties["email"].required);
                assert_eq!(states, &["active", "suspended"]);
            }
            _ => unreachable!(),
        }
    }

    #[test]
    fn plain_fence_is_prose() {
        let ast = parse("## Product\n\n```bash\ndotdog validate\n```");
        assert!(ast.sections.iter().flat_map(|s| &s.blocks).any(|block| {
            matches!(block, Block::Prose { content, .. } if content.contains("dotdog validate"))
        }));
    }
}
