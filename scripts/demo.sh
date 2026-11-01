#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI="$SCRIPT_DIR/../packages/dotdog/dist/cli.js"
DEMO_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dotdog-demo.XXXXXX")"
trap 'rm -rf -- "$DEMO_DIR"' EXIT
cd "$DEMO_DIR"
node "$CLI" kit init saas
node "$CLI" validate
node "$CLI" compile
node "$CLI" tokens
mkdir src
printf '%s\n' 'export const value = 1;' > src/value.ts
printf '%s\n' "import { value } from './value';" 'export const result = value;' > src/app.ts
node "$CLI" refresh --json
node "$CLI" context file:src/value.ts --json
node "$CLI" status --json
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"demo","version":"1"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"listProjects","arguments":{}}}' | node "$CLI" serve
