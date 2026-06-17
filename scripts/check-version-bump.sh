#!/bin/bash
# CI check: code changes must bump version
set -e

# Compare against main branch
if git diff --name-only origin/main...HEAD | grep -q "packages/dotdog/src/.*\\.ts$"; then
  if git diff --name-only origin/main...HEAD | grep -q "packages/dotdog/package.json"; then
    OLD=$(git show origin/main:packages/dotdog/package.json | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
    NEW=$(cat packages/dotdog/package.json | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
    if [ "$OLD" != "$NEW" ]; then
      echo "✓ Version bumped: $OLD → $NEW"
      exit 0
    fi
  fi
  echo "✗ Code changed but version not bumped in packages/dotdog/package.json"
  exit 1
fi

echo "✓ No code changes — version bump not required"
