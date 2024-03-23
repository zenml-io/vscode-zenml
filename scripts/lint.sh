#!/bin/bash

cd "$(dirname "$0")/.."

export PYTHONPATH="$PYTHONPATH:$(pwd)/bundled/tool"

nox --session lint

unset PYTHONPATH
