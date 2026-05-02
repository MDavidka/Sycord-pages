#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/vm-runner"
if [ ! -f package.json ]; then
  echo "vm-runner package.json missing"
  exit 1
fi
if [ ! -d node_modules ]; then
  npm install --silent
fi
npm run build --silent || true
echo "Runner auto-setup completed."
