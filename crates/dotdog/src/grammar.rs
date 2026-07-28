use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type YamlMap = BTreeMap<String, Value>;
pub type EntityView<'a> = (
    &'a str,
    &'a str,
    &'a str,
    &'a BTreeMap<String, PropertyDef>,
    &'a [String],
);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParseError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub kind: String,
    pub sections: Vec<Section>,
    pub errors: Vec<ParseError>,
}

impl Default for Document {
    fn default() -> Self {
        Self {
            kind: "document".into(),
            sections: Vec::new(),
            errors: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub kind: String,
    pub level: u8,
    pub heading: String,
    pub blocks: Vec<Block>,
    pub line_start: usize,
    pub line_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PropertyDef {
    #[serde(rename = "type")]
    pub property_type: String,
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub constraints: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub example: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Block {
    #[serde(rename_all = "camelCase")]
    Entity {
        name: String,
        description: String,
        #[serde(rename = "type")]
        entity_type: String,
        properties: BTreeMap<String, PropertyDef>,
        states: Vec<String>,
        lifecycle: Vec<String>,
        yaml: YamlMap,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Relationship {
        source: String,
        target: String,
        verb: String,
        description: String,
        cardinality: String,
        required: bool,
        cascade: String,
        invariants: Vec<String>,
        yaml: YamlMap,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Event {
        name: String,
        trigger: String,
        payload: BTreeMap<String, String>,
        preconditions: Vec<String>,
        postconditions: Vec<String>,
        side_effects: Vec<String>,
        probability: Option<f64>,
        yaml: YamlMap,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Prediction {
        statement: String,
        description: String,
        trigger: String,
        timeframe: String,
        confidence: f64,
        measurement: String,
        status: String,
        yaml: YamlMap,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Endpoint {
        name: String,
        url: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        backup_url: Option<String>,
        method: String,
        expect_status: u16,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expect_body: Option<Value>,
        timeout: u64,
        yaml: YamlMap,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Prose {
        content: String,
        line_start: usize,
        line_end: usize,
    },
    #[serde(rename_all = "camelCase")]
    Table {
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
        line_start: usize,
        line_end: usize,
    },
}

impl Block {
    pub fn entity_name(&self) -> Option<&str> {
        match self {
            Self::Entity { name, .. } => Some(name),
            Self::Event { name, .. } => Some(name),
            Self::Endpoint { name, .. } => Some(name),
            _ => None,
        }
    }

    pub fn as_entity(&self) -> Option<EntityView<'_>> {
        match self {
            Self::Entity {
                name,
                description,
                entity_type,
                properties,
                states,
                ..
            } => Some((name, description, entity_type, properties, states)),
            _ => None,
        }
    }
}

pub type DocumentNode = Document;
pub type SectionNode = Section;
pub type BlockNode = Block;
