#!/bin/bash

# Location of the typos configuration file
TYPOS_CONFIG="_typos.toml"

# Run typos command with appropriate options
typos --config "$TYPOS_CONFIG" --write-changes

# Exit with the typos command's exit code
exit $?
