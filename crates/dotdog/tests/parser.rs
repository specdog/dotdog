use dotdog::grammar::BlockNode;
use dotdog::parser::parse;

const SPEC: &str = r#"## Data Model

### Entity: Node

A node in the spec graph.

```
entity: Node
type: entity
properties:
  id:
    type: string
    required: true
states: [draft, complete]
lifecycle: draft → complete
```

### Entity: Task

```
entity: Task
type: entity
```

### Relationship: Node → Task

```
relationship: Node → Task
verb: contains
cardinality: 1:n
required: false
```
"#;

#[test]
fn parses_entities_relationships_and_properties() {
    let document = parse(SPEC);
    let blocks: Vec<_> = document
        .sections
        .iter()
        .flat_map(|section| section.blocks.iter())
        .collect();

    assert!(
        blocks
            .iter()
            .any(|block| matches!(block, BlockNode::Entity { name, .. } if name == "Node"))
    );
    assert!(blocks.iter().any(|block| matches!(block, BlockNode::Relationship { source, target, .. } if source == "Node" && target == "Task")));
}

#[test]
fn serializes_document_with_legacy_field_names() {
    let json = serde_json::to_value(parse(SPEC)).unwrap();
    assert_eq!(json["kind"], "document");
    assert!(json["sections"][0].get("lineStart").is_some());
    assert!(json["sections"][0].get("lineEnd").is_some());
}
