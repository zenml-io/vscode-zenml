#!/bin/bash
set -euxo pipefail

# source directory for python tool
python_src="bundled/tool"

echo "Formatting Python files in bundled/tool..."
# autoflake replacement: removes unused imports and variables
ruff check $python_src --select F401,F841 --fix --exclude "__init__.py" --isolated

# isort replacement: sorts imports
ruff check $python_src --select I --fix --ignore D

# black replacement: formats code
ruff format $python_src

echo "Formatting TypeScript files..."
npm run format

echo "Formatting YAML files..."
find .github -name "*.yml" -print0 | xargs -0 yamlfix --

echo "Formatting complete."
