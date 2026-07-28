use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::tempdir;

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

A work item.

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

fn binary() -> &'static str {
    env!("CARGO_BIN_EXE_dotdog")
}

fn project(root: &std::path::Path, name: &str) {
    let path = root.join("projects").join(name);
    fs::create_dir_all(&path).unwrap();
    fs::write(path.join("SPEC.dog"), SPEC).unwrap();
    fs::write(path.join("constitution.dog"), "# Constitution\n").unwrap();
    fs::write(path.join("data-model.dog"), "# Data Model\n").unwrap();
}

#[test]
fn version_is_semver() {
    let output = Command::new(binary()).arg("--version").output().unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.trim().starts_with("0.9.0"));
}

#[test]
fn init_list_validate_compile_visualize_and_audit() {
    let root = tempdir().unwrap();

    let init = Command::new(binary())
        .current_dir(root.path())
        .args(["init", "sample"])
        .output()
        .unwrap();
    assert!(init.status.success());
    assert!(root.path().join("specs/sample/SPEC.dog").exists());

    project(root.path(), "graph");

    let list = Command::new(binary())
        .current_dir(root.path())
        .args(["list", "--json"])
        .output()
        .unwrap();
    assert!(list.status.success());
    let names: Vec<String> = serde_json::from_slice(&list.stdout).unwrap();
    assert!(names.contains(&"graph".to_string()));
    assert!(names.contains(&"sample".to_string()));

    let validate = Command::new(binary())
        .current_dir(root.path())
        .arg("validate")
        .output()
        .unwrap();
    assert!(validate.status.success());

    let compile = Command::new(binary())
        .current_dir(root.path())
        .arg("compile")
        .output()
        .unwrap();
    assert!(compile.status.success());
    let dag = root.path().join("projects/graph/graph.dag");
    assert!(dag.exists());

    let visualize = Command::new(binary())
        .current_dir(root.path())
        .arg("visualize")
        .output()
        .unwrap();
    assert!(visualize.status.success());
    let mermaid = String::from_utf8(visualize.stdout).unwrap();
    assert!(mermaid.contains("Node"));
    assert!(mermaid.contains("Task"));

    let audit = Command::new(binary())
        .current_dir(root.path())
        .args([
            "audit",
            "--require-kind",
            "entity",
            "--json",
            dag.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(audit.status.success());
    let report: serde_json::Value = serde_json::from_slice(&audit.stdout).unwrap();
    assert_eq!(report["ok"], true);
    assert_eq!(report["missingKinds"], serde_json::json!([]));
}

#[test]
fn path_finds_shortest_repo_world_connection() {
    let root = tempdir().unwrap();
    let dag_dir = root.path().join(".doghouse/compiled");
    fs::create_dir_all(&dag_dir).unwrap();
    let dag = dag_dir.join("repo.dag");
    fs::write(
        &dag,
        serde_json::json!({
            "version": "0.1",
            "project": "path-test",
            "nodes": [
                { "id": "symbol:user", "kind": "symbol", "label": "User Service", "source": "src/user.rs", "confidence": "certain" },
                { "id": "symbol:db", "kind": "symbol", "label": "Database Pool", "source": "src/db.rs", "confidence": "likely" }
            ],
            "edges": [
                { "id": "edge", "sourceId": "symbol:user", "targetId": "symbol:db", "verb": "calls", "confidence": "certain" }
            ],
            "predictions": [],
            "unknowns": []
        })
        .to_string(),
    )
    .unwrap();

    let output = Command::new(binary())
        .current_dir(root.path())
        .args([
            "path",
            "User",
            "Database",
            "--dag",
            dag.to_str().unwrap(),
            "--json",
        ])
        .output()
        .unwrap();
    assert!(output.status.success());
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["ok"], true);
    assert_eq!(result["hops"], 1);
}

#[test]
fn guide_and_interactive_map_are_human_usable() {
    let root = tempdir().unwrap();
    project(root.path(), "graph");

    let compile = Command::new(binary())
        .current_dir(root.path())
        .arg("compile")
        .output()
        .unwrap();
    assert!(compile.status.success());

    let graph = root.path().join("projects/graph/graph.dag");
    let output = Command::new(binary())
        .current_dir(root.path())
        .args([
            "visualize",
            graph.to_str().unwrap(),
            "--format",
            "html",
            "--save",
            "--output",
            "map.html",
        ])
        .output()
        .unwrap();
    assert!(output.status.success());
    let html = fs::read_to_string(root.path().join("map.html")).unwrap();
    assert!(html.contains("Interactive Dotdog graph"));
    assert!(html.contains("Find a node"));
    assert!(html.contains("Drag to pan"));
    assert!(!html.contains("<script src="));
    assert!(!html.contains("<link rel="));

    for workflow in ["greenfield", "existing", "speckit"] {
        let guide = Command::new(binary())
            .args(["guide", workflow])
            .output()
            .unwrap();
        assert!(guide.status.success());
        let text = String::from_utf8(guide.stdout).unwrap();
        assert!(text.contains("dotdog"));
        assert!(text.contains("1."));
    }
}

#[test]
fn workspace_commands_keep_paths_portable() {
    let root = tempdir().unwrap();
    let product = root.path().join("product");
    let api = root.path().join("api");
    fs::create_dir_all(&product).unwrap();
    fs::create_dir_all(&api).unwrap();

    let init = Command::new(binary())
        .current_dir(&product)
        .args(["workspace", "init", "--id", "example-product"])
        .output()
        .unwrap();
    assert!(
        init.status.success(),
        "{}",
        String::from_utf8_lossy(&init.stderr)
    );

    let add = Command::new(binary())
        .current_dir(&product)
        .args([
            "workspace",
            "add",
            api.to_str().unwrap(),
            "--alias",
            "api",
            "--role",
            "api",
        ])
        .output()
        .unwrap();
    assert!(
        add.status.success(),
        "{}",
        String::from_utf8_lossy(&add.stderr)
    );

    let validate = Command::new(binary())
        .current_dir(&product)
        .args(["workspace", "validate", "--json"])
        .output()
        .unwrap();
    assert!(validate.status.success());
    let validation: serde_json::Value = serde_json::from_slice(&validate.stdout).unwrap();
    assert_eq!(validation["valid"], true);

    let list = Command::new(binary())
        .current_dir(&product)
        .args(["workspace", "list", "--json"])
        .output()
        .unwrap();
    assert!(list.status.success());
    let workspace: serde_json::Value = serde_json::from_slice(&list.stdout).unwrap();
    assert_eq!(workspace["workspace"]["id"], "example-product");
    assert_eq!(workspace["repos"][0]["path"], ".");
    assert_eq!(workspace["repos"][1]["path"], "../api");
    assert!(
        !String::from_utf8(list.stdout)
            .unwrap()
            .contains(root.path().to_str().unwrap())
    );
}

#[test]
fn mcp_transcript_lists_typed_tools_and_ignores_notifications() {
    let root = tempdir().unwrap();
    project(root.path(), "graph");
    let compile = Command::new(binary())
        .current_dir(root.path())
        .arg("compile")
        .output()
        .unwrap();
    assert!(compile.status.success());

    let mut server = Command::new(binary())
        .current_dir(root.path())
        .arg("serve")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = [
        serde_json::json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}),
        serde_json::json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        serde_json::json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        serde_json::json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"listProjects","arguments":{}}}),
    ]
    .map(|request| request.to_string())
    .join("\n");
    input.push('\n');
    server
        .stdin
        .as_mut()
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();
    drop(server.stdin.take());
    let output = server.wait_with_output().unwrap();
    assert!(output.status.success());
    let responses = String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str::<serde_json::Value>(line).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(responses.len(), 3);
    assert_eq!(responses[0]["result"]["serverInfo"]["name"], "spec-serve");
    assert_eq!(responses[1]["result"]["tools"].as_array().unwrap().len(), 9);
    assert_eq!(
        responses[1]["result"]["tools"][0]["inputSchema"]["required"][0],
        "name"
    );
    assert!(
        responses[2]["result"]["content"][0]["text"]
            .as_str()
            .unwrap()
            .contains("graph")
    );
}

#[test]
fn map_compile_and_query_cover_an_existing_repository() {
    let root = tempdir().unwrap();
    fs::create_dir_all(root.path().join("src")).unwrap();
    fs::write(
        root.path().join("Cargo.toml"),
        "[package]\nname = \"mapped-app\"\nversion = \"0.1.0\"\n",
    )
    .unwrap();
    fs::write(root.path().join("src/main.rs"), "fn main() {}\n").unwrap();

    let map = Command::new(binary())
        .current_dir(root.path())
        .args(["map", "--json"])
        .output()
        .unwrap();
    assert!(
        map.status.success(),
        "{}",
        String::from_utf8_lossy(&map.stderr)
    );
    let result: serde_json::Value = serde_json::from_slice(&map.stdout).unwrap();
    assert!(result["facts"].as_u64().unwrap() > 0);

    let compile = Command::new(binary())
        .current_dir(root.path())
        .arg("compile")
        .output()
        .unwrap();
    assert!(compile.status.success());
    assert!(root.path().join(".doghouse/compiled/repo.dag").exists());

    let query = Command::new(binary())
        .current_dir(root.path())
        .args(["query", "main"])
        .output()
        .unwrap();
    assert!(query.status.success());
    assert!(
        String::from_utf8(query.stdout)
            .unwrap()
            .contains("src/main.rs")
    );

    let observe = Command::new(binary())
        .current_dir(root.path())
        .arg("observe")
        .output()
        .unwrap();
    assert!(observe.status.success());
    fs::remove_file(root.path().join("src/main.rs")).unwrap();
    let drift = Command::new(binary())
        .current_dir(root.path())
        .args(["drift", "--json"])
        .output()
        .unwrap();
    assert!(!drift.status.success());
    let report: serde_json::Value = serde_json::from_slice(&drift.stdout).unwrap();
    assert_eq!(report["ok"], false);
    assert!(
        report["drift"]
            .as_array()
            .unwrap()
            .iter()
            .any(|change| change["file"] == "src/main.rs")
    );
}

#[test]
fn live_checks_an_endpoint_contract_without_an_external_cli() {
    let root = tempdir().unwrap();
    project(root.path(), "live");
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
        Err(error) => panic!("{error}"),
    };
    let address = listener.local_addr().unwrap();
    let server = thread::spawn(move || {
        listener.set_nonblocking(true).unwrap();
        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(5) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let mut request = [0u8; 2048];
                    let _ = stream.read(&mut request).unwrap();
                    stream
                        .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                        .unwrap();
                    return;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("{error}"),
            }
        }
        panic!("endpoint checker did not connect");
    });
    fs::write(
        root.path().join("projects/live/endpoints.dog"),
        format!(
            "## Contracts\n\n### Endpoint: health\n\n```yaml\nendpoint: health\nurl: http://{address}/health\nmethod: GET\nexpect_status: 204\ntimeout: 2\n```\n"
        ),
    )
    .unwrap();

    let live = Command::new(binary())
        .current_dir(root.path())
        .args(["live", "health", "--type", "endpoint", "--exit-code"])
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(
        live.status.success(),
        "{}",
        String::from_utf8_lossy(&live.stderr)
    );
    assert!(String::from_utf8(live.stdout).unwrap().contains("✓ health"));

    fs::write(
        root.path().join("projects/live/infra.dog"),
        "## Infrastructure\n\n### Entity: ExampleResource\n\n```yaml\nentity: ExampleResource\ntype: infrastructure\nproperties:\n  provider:\n    type: string\n    default: unknown\n  resource:\n    type: string\n    default: thing:example\n```\n",
    )
    .unwrap();
    let infra = Command::new(binary())
        .current_dir(root.path())
        .args(["live", "ExampleResource", "--type", "infra", "--exit-code"])
        .output()
        .unwrap();
    assert!(infra.status.success());
    assert!(
        String::from_utf8(infra.stdout)
            .unwrap()
            .contains("unknown provider")
    );
}
