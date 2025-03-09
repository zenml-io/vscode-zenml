#!/bin/bash
set -euxo pipefail

cd "$(dirname "$0")/.." || exit
printf "Working directory: %s\n" "$(pwd)"
# set PYTHONPATH to include bundled/tool
PYTHONPATH="${PYTHONPATH-}:$(pwd)/bundled/tool"
export PYTHONPATH

PYTHON_SRC="bundled/tool"

echo "Linting Python files..."
ruff check $PYTHON_SRC

echo "Checking for unused imports and variables..."
ruff check $PYTHON_SRC --select F401,F841 --exclude "__init__.py" --isolated

echo "Checking Python formatting..."
ruff format $PYTHON_SRC --check

echo "Type checking python files with mypy..."
mypy $PYTHON_SRC

echo "Linting TypeScript files with eslint..."
npm run lint

echo "Checking yaml files with yamlfix..."
yamlfix .github/workflows/*.yml --check

unset PYTHONPATH
