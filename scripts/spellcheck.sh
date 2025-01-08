#!/bin/bash

show_help() {
    echo "Usage: $(basename "$0") [OPTIONS] [CONFIG_PATH]"
    echo
    echo "If no config path is provided, the script will look for:"
    echo "  - .typos.toml in current directory"
    echo "  - .typos.toml in parent directory"
    echo "  - If no config is found, will fall back to typos defaults"
}

# Enable help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

if [ ! -z "$1" ]; then
    if [ -f "$1" ]; then
        echo "Using config: $1"
        typos --config "$1"
    else
        echo "Warning: Config file not found at $1"
        echo "Falling back to typos defaults..."
        typos
    fi
elif [ -f ".typos.toml" ]; then
    echo "Using config from current directory: .typos.toml"
    typos --config ".typos.toml"
elif [ -f "../.typos.toml" ]; then
    echo "Using config from parent directory: ../.typos.toml"
    typos --config "../.typos.toml"
else
    echo "No config file found, using typos defaults..."
    typos
fi