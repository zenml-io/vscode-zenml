#!/bin/bash
set -euxo pipefail

cd "$(dirname "$0")/.." || exit
printf "Working directory: %s\n" "$(pwd)"
# Set PYTHONPATH to include bundled/tool
PYTHONPATH="${PYTHONPATH-}:$(pwd)/bundled/tool"
export PYTHONPATH

# Lint Python files with ruff
echo "Linting Python files..."
ruff bundled/tool || { echo "Linting Python files failed"; exit 1; }

# Type check Python files with mypy
echo "Type checking Python files with mypy..."
mypy bundled/tool || { echo "Type checking Python files with mypy failed"; exit 1; }

# Lint TypeScript files with eslint
echo "Linting TypeScript files..."
npx eslint 'src/**/*.ts' || { echo "Linting TypeScript files failed"; exit 1; }

# Lint YAML files with yamlfix
echo "Checking YAML files with yamlfix..."
yamlfix .github/workflows/*.yml --check || { echo "Linting YAML files failed"; exit 1; }

unset PYTHONPATH
