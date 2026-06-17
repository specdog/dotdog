#!/bin/bash
set -e
echo "Scanning .dog files..."

FOUND=0
for file in $(find . -name "*.dog" -not -path "*/node_modules/*" -not -path "*/.git/*"); do
  if grep -qinE "IGNORE PREVIOUS|DISREGARD PREVIOUS|FORGET PREVIOUS|You are now|Your task is|Please disregard|bypass your|new instructions|ignore all previous|SYSTEM NOTE|SYSTEM OVERRIDE|from now on you are" "$file"; then
    echo "  ✗ $file"
    FOUND=1
  fi
done

if [ $FOUND -eq 0 ]; then
  echo "✓ Clean"
  exit 0
else
  echo "✗ $FOUND file(s) with suspicious patterns"
  exit 1
fi
