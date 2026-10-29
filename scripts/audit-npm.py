import argparse
import http.server
import json
from pathlib import Path
import statistics
import subprocess
import tempfile
import threading
import time


parser = argparse.ArgumentParser()
parser.add_argument("cli", type=Path)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
cli = args.cli.resolve()
results = {}


def run(root, *commands):
    started = time.perf_counter()
    proc = subprocess.run(
        ["node", str(cli), *commands], cwd=root, text=True,
        capture_output=True, timeout=20,
    )
    return {
        "code": proc.returncode, "stdout": proc.stdout,
        "stderr": proc.stderr, "ms": round((time.perf_counter() - started) * 1000, 2),
    }


def rpc(root, calls):
    requests = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-11-25", "capabilities": {},
        "clientInfo": {"name": "dotdog-audit", "version": "1"},
    }}]
    requests.extend({"jsonrpc": "2.0", "id": i + 2, "method": "tools/call",
                     "params": {"name": name, "arguments": values}}
                    for i, (name, values) in enumerate(calls))
    proc = subprocess.run(
        ["node", str(cli), "serve"], cwd=root, text=True, capture_output=True,
        input="".join(json.dumps(req) + "\n" for req in requests), timeout=20,
    )
    responses = [json.loads(line) for line in proc.stdout.splitlines()]
    return {"code": proc.returncode, "responses": responses, "stderr": proc.stderr}


def payload(response):
    return json.loads(response["result"]["content"][0]["text"])


class Endpoint(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"not-json")

    def log_message(self, *values):
        pass


with tempfile.TemporaryDirectory(prefix="dotdog-npm-audit-") as temporary:
    base = Path(temporary)
    root = base / "project"
    root.mkdir()
    results["version"] = run(root, "--version")
    results["empty_validate"] = run(root, "validate")
    results["empty_design_strict"] = run(root, "design", "--strict", "--json")
    results["empty_drift"] = run(root, "drift", "--json")
    results["init"] = run(root, "init", "empty")
    results["scaffold_validate"] = run(root, "validate")
    results["scaffold_compile"] = run(root, "compile")
    results["scaffold_graph"] = rpc(root, [("summary", {"project": "empty"})])
    minimal = base / "minimal"
    minimal.mkdir()
    run(minimal, "init", "minimal", "--minimal")
    results["minimal_validate"] = run(minimal, "validate")
    kits = base / "kits"
    kits.mkdir()
    results["kit_list"] = run(kits, "kit", "list")
    results["kits"] = {}
    for kit in ["dao", "defi", "ecommerce", "erc20", "hackathon", "nft", "saas"]:
        results["kits"][kit] = {
            "init": run(kits, "kit", "init", kit),
            "compile": run(kits, "compile"),
        }
    results["kit_validate"] = run(kits, "validate")
    results["kit_tokens"] = run(kits, "tokens")
    results["kit_graph"] = rpc(kits, [
        ("summary", {"project": "saas"}),
        ("search", {"project": "saas", "q": ""}),
    ])
    entities = payload(results["kit_graph"]["responses"][-1])
    calls = [("getEntity", {"project": "saas", "name": name}) for _, name in entities]
    results["kit_entities"] = rpc(kits, calls)
    edge_entities = [payload(res) for res in results["kit_entities"]["responses"][1:]
                     if payload(res).get("edges")]
    if edge_entities:
        entity = edge_entities[0]
        results["v3_traverse"] = rpc(kits, [
            ("traverse", {"project": "saas", "from": entity["name"], "depth": 3}),
            ("schema", {"project": "saas", "entity": entity["name"]}),
        ])
    results["kit_index"] = run(kits, "index")
    results["kit_search"] = run(kits, "search", "subscription", "--project", "saas")
    results["init_over_existing"] = run(kits, "init", "saas")
    run(kits, "compile")
    results["overwritten_graph"] = rpc(kits, [("summary", {"project": "saas"})])
    run(kits, "compile", "--v2")
    results["v2_mcp"] = rpc(kits, [("search", {"project": "ecommerce", "q": ""})])
    results["direct_project_compile"] = run(kits, "compile", "specs/ecommerce")
    results["missing_kit"] = run(kits, "kit", "init", "does-not-exist")
    results["missing_path_json"] = run(kits, "path", "missing-a", "missing-b",
        "--dag", "specs/ecommerce/ecommerce.dag", "--json")
    results["missing_path_text"] = run(kits, "path", "missing-a", "missing-b",
        "--dag", "specs/ecommerce/ecommerce.dag")

    protocol = base / "protocol"
    protocol.mkdir()
    messages = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2026-07-28", "capabilities": {},
            "clientInfo": {"name": "audit", "version": "1"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "ping"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "listProjects"}},
    ]
    proc = subprocess.run(["node", str(cli), "serve"], cwd=protocol, text=True,
        capture_output=True, input="".join(json.dumps(x) + "\n" for x in messages), timeout=10)
    results["protocol"] = {"stdout": proc.stdout, "stderr": proc.stderr, "code": proc.returncode}

    mapped = base / "mapped"
    (mapped / "app").mkdir(parents=True)
    (mapped / "pages").mkdir()
    (mapped / "app/page.tsx").write_text("export default function Home() { return null; }\n")
    (mapped / "pages/index.tsx").write_text("export default function Home() { return null; }\n")
    (mapped / "src").mkdir()
    (mapped / "src/core.ts").write_text("export const core = 1;\n")
    (mapped / "README.md").write_text("# Audit fixture\n")
    results["map"] = run(mapped, "map", "--json")
    results["map_then_query"] = run(mapped, "query", "repository")
    results["map_compile"] = run(mapped, "compile")
    results["mapped_routes"] = rpc(mapped, [("search", {"q": ""})])
    results["observe_first"] = run(mapped, "observe", "--json")
    results["observe_second"] = run(mapped, "observe", "--json")
    results["observe_third"] = run(mapped, "observe", "--json")
    (mapped / "README.md").unlink()
    results["drift_missing_file"] = run(mapped, "drift", "--json")
    big = base / "big"
    big.mkdir()
    for i in range(501):
        (big / f"{i:04d}.md").write_text("# Audit fixture\n")
    results["map_501_files"] = run(big, "map", "--json")

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Endpoint)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/health"
    for version in [2, 3]:
        live = base / f"live-v{version}"
        live.mkdir()
        props = ["url", url, "expect_status", "200", "expect_body", '{"ok":true}']
        dag = {"v": 2, "p": "live", "n": [[0, "Health", "endpoint", "", props, [], []]]}
        if version == 3:
            dag = [3, "live", [["Health", "e", props, None, None]], {}]
        (live / "live.dag").write_text(json.dumps(dag))
        results[f"live_v{version}"] = run(live, "live", "--type", "endpoint", "--exit-code", "--timeout", "1")
    server.shutdown()
    times = [run(root, "--version")["ms"] for _ in range(10)]
    results["startup"] = {"runs": len(times), "median_ms": statistics.median(times), "min_ms": min(times), "max_ms": max(times)}
    serialized = json.dumps(results, indent=2).replace(str(base.resolve()), "<fixture>").replace(str(base), "<fixture>")
    args.output.write_text(serialized + "\n")
    print(json.dumps({"output": str(args.output), "cases": len(results), "startup": results["startup"]}, indent=2))
