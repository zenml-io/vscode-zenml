#!/bin/bash

echo "Removing bundled/tool/__pycache__..."
rm -rf bundled/tool/__pycache__

echo "Removing dist directory..."
rm -rf dist

echo "Recompiling with npm..."
npm run compile

echo "Operation completed."
