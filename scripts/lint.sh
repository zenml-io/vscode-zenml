#!/bin/bash
set -euxo pipefail

cd "$(dirname "$0")/.." || exit

PYTHONPATH="$PYTHONPATH:$(pwd)/bundled/tool"
export PYTHONPATH

# Lint Python files with ruff
echo "Linting Python files..."
ruff bundled/tool || { echo "Linting Python files failed"; exit 1; }

# Lint TypeScript files with eslint
echo "Linting TypeScript files..."
npx eslint 'src/**/*.ts' || { echo "Linting TypeScript files failed"; exit 1; }

unset PYTHONPATH
