#!/usr/bin/env python3
"""Parse agent-bench results and output comparison table."""
import json, os, sys, yaml
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else SCRIPT_DIR / "results"

def read_jsonl_tokens(path_glob: str, key: str) -> dict:
    import glob
    total = 0
    files = glob.glob(os.path.expanduser(path_glob))
    for f in files:
        try:
            for line in open(f):
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                # Navigate dotted key path
                val = data
                for k in key.split("."):
                    val = val.get(k, {})
                if isinstance(val, (int, float)):
                    total += int(val)
        except (json.JSONDecodeError, OSError, KeyError):
            continue
    return total

def read_collar_tokens() -> int:
    try:
        import subprocess
        r = subprocess.run(["collar", "insights", "--days", "1", "--json"], 
                          capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            return json.loads(r.stdout).get("total_tokens", 0)
    except Exception:
        pass
    return 0

# Collect per-agent totals
config = yaml.safe_load((SCRIPT_DIR / "agents.yaml").read_text())
totals = defaultdict(lambda: {"input": 0, "output": 0, "total": 0, "wall_time": 0, "count": 0})

for result_file in sorted(RESULTS_DIR.glob("*.json")):
    data = json.loads(result_file.read_text())
    agent = data["agent"]
    totals[agent]["wall_time"] += data.get("wall_time_s", 0)
    totals[agent]["count"] += 1

# Read token data from logs
for agent_id, agent_cfg in config["agents"].items():
    if agent_cfg.get("log_type") == "collar_insights":
        totals[agent_id]["total"] = read_collar_tokens()
    elif agent_cfg.get("log_type") == "jsonl":
        path = agent_cfg.get("log_path", "")
        key = agent_cfg.get("log_key", "usage.total_tokens")
        totals[agent_id]["total"] = read_jsonl_tokens(path, key)

# Output
print()
print("| Agent | Runs | Avg Wall Time | Total Tokens |")
print("|-------|------|---------------|-------------|")
for agent_id, agent_cfg in config["agents"].items():
    t = totals[agent_id]
    n = t["count"]
    avg_time = f"{t['wall_time']/n:.1f}s" if n else "N/A"
    tokens = f"{t['total']:,}" if t["total"] else "N/A"
    print(f"| {agent_cfg['name']:<25s} | {n:>4} | {avg_time:>13s} | {tokens:>11s} |")

# Comparison
collar_total = totals["collar"]["total"]
claude_total = totals["claude"]["total"]
codex_total = totals["codex"]["total"]

print()
if collar_total and claude_total:
    save = claude_total - collar_total
    pct = (save / claude_total) * 100 if claude_total else 0
    print(f"Collar saves {save:,} tokens ({pct:.0f}%) vs Claude Code on identical task.")
if collar_total and codex_total:
    save = codex_total - collar_total
    pct = (save / codex_total) * 100 if codex_total else 0
    print(f"Collar saves {save:,} tokens ({pct:.0f}%) vs Codex on identical task.")
print()
