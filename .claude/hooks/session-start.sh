#!/bin/bash
set -euo pipefail

# SessionStart hook: Install dependencies for Claude Code on the web
# This ensures pnpm modules are available before tests, linters, or type checking

echo '{"async": false}'

# Install pnpm global if not available
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@9.15.9
fi

# Install dependencies
echo "Installing project dependencies..."
cd "$CLAUDE_PROJECT_DIR"
pnpm install

echo "✓ Dependencies installed successfully"
