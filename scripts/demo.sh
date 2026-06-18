#!/bin/bash
# dotdog demo script — terminal recording for asciinema
# Usage: asciinema rec demo.cast -c ./demo.sh

set -e

DELAY=0.15
PROJECT="demo-$(date +%s)"

# Helper: type text with human-like delay
type_text() {
  echo -n "$1" | while IFS= read -r -n1 char; do
    echo -n "$char"
    sleep "$DELAY"
  done
  sleep 0.5
  echo
}

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  dotdog — specs that agents can actually use"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1

# 1. Init
echo ""
echo "$ dotdog init --guided"
sleep 0.5
dotdog init "$PROJECT" -g --purpose "Payment processing API" --users "developer,agent" --rules "idempotent,audited,rate-limited" --entities "Payment,Customer,Webhook,Invoice" 2>&1
sleep 1

# 2. Show the files
echo ""
echo "$ ls specs/$PROJECT/"
ls specs/"$PROJECT"/ 2>&1
sleep 1

# 3. Validate
echo ""
echo "$ dotdog validate"
dotdog validate 2>&1
sleep 1

# 4. Compile
echo ""
echo "$ dotdog compile"
dotdog compile 2>&1
sleep 1

# 5. Show the DAG size comparison
SPEC_SIZE=$(wc -c < specs/"$PROJECT"/SPEC.dog 2>/dev/null || echo 0)
DM_SIZE=$(wc -c < specs/"$PROJECT"/data-model.dog 2>/dev/null || echo 0)
CONST_SIZE=$(wc -c < specs/"$PROJECT"/constitution.dog 2>/dev/null || echo 0)
TOTAL=$((SPEC_SIZE + DM_SIZE + CONST_SIZE))
DAG_SIZE=$(wc -c < specs/"$PROJECT"/"$PROJECT".dag 2>/dev/null || echo 1)
SAVINGS=$(echo "scale=1; 100 - ($DAG_SIZE * 100 / $TOTAL)" | bc 2>/dev/null || echo "0")

echo ""
echo "  Spec files: $TOTAL bytes → DAG: $DAG_SIZE bytes ($SAVINGS% smaller)"
sleep 1

# 6. Serve (simulated — just show the command)
echo ""
echo "$ dotdog serve"
echo "  MCP server ready — 7 tools available"
echo "  Agent can query: getEntity, traverse, search, summary, schema, listProjects, listBlogs"
sleep 1

# 7. Show the geo
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  3 .dog files → compile → .dag graph"
echo "  $TOTAL → $DAG_SIZE tokens ($SAVINGS% savings)"
echo "  Agents query the DAG, never hallucinate entities"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 2

# Cleanup
rm -rf specs/"$PROJECT"/
