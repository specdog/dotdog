#!/bin/bash
# dotdog pre-commit hook — auto-compile .dog → .dag, block regression
set -e

CHANGED_DOG=$(git diff --cached --name-only --diff-filter=ACM | grep '\.dog$' || true)
if [ -z "$CHANGED_DOG" ]; then exit 0; fi

echo "dotdog: compiling changed .dog files..."
dotdog compile > /dev/null 2>&1 || { echo "dotdog compile failed — fix errors before commit"; exit 1; }

# Stage compiled .dag files
for dog in $CHANGED_DOG; do
  dir=$(dirname "$dog")
  base=$(basename "$dog" .dog)
  dag="$dir/$base.dag"
  if [ -f "$dag" ]; then
    git add "$dag"
    echo "  ✓ staged $dag"
  fi
done

echo "dotdog: ok"
