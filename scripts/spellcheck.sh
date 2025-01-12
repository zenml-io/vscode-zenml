#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
DEFAULT_CONFIG_PATH="${REPO_ROOT}/.typos.toml"

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    echo "This is a wrapper around typos that enforces repository config."
    echo "For available options, see: typos --help"
    exit 0
fi

# Error out if the default config is not found
if [[ ! -f "$DEFAULT_CONFIG_PATH" ]]; then
    echo "ERROR: Repository config not found at $DEFAULT_CONFIG_PATH"
    exit 1
fi

# Remove any -c/--config arguments to prevent override attempts
args=()
skip_next=0
for arg in "$@"; do
    if ((skip_next)); then
        skip_next=0
        continue
    fi
    if [[ "$arg" == "--config" ]] || [[ "$arg" == "-c" ]]; then
        echo "WARNING: Custom config path ignored, using repository config"
        skip_next=1
        continue
    fi
    if [[ "$arg" == --config=* ]] || [[ "$arg" == -c=* ]]; then
        echo "WARNING: Custom config path ignored, using repository config"
        continue
    fi
    args+=("$arg")
done

exec typos --config "$DEFAULT_CONFIG_PATH" "${args[@]+"${args[@]}"}"
