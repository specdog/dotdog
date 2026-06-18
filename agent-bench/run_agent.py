#!/usr/bin/env python3
"""Run a single agent benchmark and record results."""
import argparse, json, os, subprocess, sys, time, yaml
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG = yaml.safe_load((SCRIPT_DIR / "agents.yaml").read_text())

def run_agent(agent_id: str, prompt: str, label: str, output: str | None = None):
    agent = CONFIG["agents"][agent_id]
    cmd = agent["command"].replace("{prompt}", prompt)
    
    start = time.time()
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=600)
    elapsed = time.time() - start
    
    record = {
        "agent": agent_id,
        "label": label,
        "prompt": prompt,
        "exit_code": result.returncode,
        "stdout_chars": len(result.stdout),
        "stderr_chars": len(result.stderr),
        "wall_time_s": round(elapsed, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    
    if output:
        Path(output).write_text(json.dumps(record, indent=2))
    
    print(json.dumps(record, indent=2))
    return record

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--agent", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--label", default="run")
    p.add_argument("--output", default=None)
    args = p.parse_args()
    run_agent(args.agent, args.prompt, args.label, args.output)
