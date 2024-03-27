#!/bin/bash

echo "Removing bundled/tool/__pycache__..."
if [ -d "bundled/tool/__pycache__" ]; then
  rm -rf bundled/tool/__pycache__
fi

echo "Removing dist directory..."
if [ -d "dist" ]; then
  rm -rf dist
fi

echo "Recompiling with npm..."
if ! command -v npm &> /dev/null
then
  echo "npm could not be found. Please install npm to proceed."
  exit 1
fi
npm run compile

echo "Operation completed."
