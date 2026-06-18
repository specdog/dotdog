# agent-bench

> Real token benchmarks for AI coding agents. No estimates. No bias. Just data.

Measures token consumption across agents by running identical tasks and reading official client logs via [CodexBar](https://github.com/steipete/CodexBar).

## Supported Agents

| Agent | Source | Measurement |
|-------|--------|-------------|
| collar | This repo | `dag insights` + session logs |
| Claude Code | Anthropic | `~/Library/Application Support/Claude/usage/` |
| OpenAI Codex | OpenAI | `~/.codex/usage/` |
| OpenClaw | openclaw/openclaw | Coming soon |

## Quick Start

```bash
# Install dependencies
brew install --cask codexbar      # macOS menu bar token monitor
pip install collar                 # collar agent harness

# Run benchmark
bash run.sh "Write a Python script that reads CSV sales data and outputs a grouped report"

# Parse results
python3 parse.py
```

## How It Works

1. **run.sh** — executes the same prompt through each agent, waits for CodexBar to capture
2. **parse.py** — reads CodexBar + official client logs, formats comparison table
3. Token counts come from the agents' own reporting, not our estimates

## Sample Output

```
| Agent           | Input Tokens | Output Tokens | Total Tokens |
|-----------------|-------------|--------------|-------------|
| collar (DAG)    |      12,345 |        2,100 |      14,445 |
| Claude Code     |      18,900 |        3,200 |      22,100 |
| OpenAI Codex    |      15,600 |        2,800 |      18,400 |

Collar saves 7,655 tokens (35%) vs Claude Code on identical task.
```

## Adding Agents

1. Add agent to `agents.yaml` with run command and log path
2. Submit PR
3. CI verifies the benchmark runs
