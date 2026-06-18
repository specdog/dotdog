#!/usr/bin/env bash
# agent-bench: run identical task across all configured agents
# Usage: bash run.sh "your task prompt here"
set -euo pipefail

PROMPT="${1:?Usage: bash run.sh 'task prompt'}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Read agent configs
AGENTS_YAML="$SCRIPT_DIR/agents.yaml"
WARMUP=$(python3 -c "import yaml; print(yaml.safe_load(open('$AGENTS_YAML'))['settings']['warmup_runs'])" 2>/dev/null || echo 1)
RUNS=$(python3 -c "import yaml; print(yaml.safe_load(open('$AGENTS_YAML'))['settings']['measured_runs'])" 2>/dev/null || echo 3)
COOLDOWN=$(python3 -c "import yaml; print(yaml.safe_load(open('$AGENTS_YAML'))['settings']['cooldown_seconds'])" 2>/dev/null || echo 5)

echo "=== agent-bench ==="
echo "Task: $PROMPT"
echo "Warmup: $WARMUP  Runs: $RUNS  Cooldown: ${COOLDOWN}s"
echo "Results: $RESULTS_DIR"
echo ""

# Warmup runs (discarded)
echo "--- Warmup ---"
python3 "$SCRIPT_DIR/run_agent.py" --agent collar --prompt "$PROMPT" --label warmup
sleep "$COOLDOWN"

# Measured runs
echo ""
echo "--- Measured ---"
for agent in collar claude codex; do
    echo ""
    echo "=== $agent ==="
    for i in $(seq 1 $RUNS); do
        echo "  Run $i/$RUNS..."
        python3 "$SCRIPT_DIR/run_agent.py" \
            --agent "$agent" \
            --prompt "$PROMPT" \
            --label "run_${i}" \
            --output "$RESULTS_DIR/${agent}_run_${i}.json"
        sleep "$COOLDOWN"
    done
done

echo ""
echo "=== Done ==="
echo "Parse results: python3 $SCRIPT_DIR/parse.py $RESULTS_DIR"
