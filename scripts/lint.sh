#!/bin/bash

cd "$(dirname "$0")/.." || exit

PYTHONPATH="$PYTHONPATH:$(pwd)/bundled/tool"
export PYTHONPATH

nox --session lint

unset PYTHONPATH
