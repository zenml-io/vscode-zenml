# ZenML Extension Version Compatibility

This file serves as a reference for ZenML extension version compatibility with different ZenML library versions. If you're working with an older version of ZenML, please install the appropriate extension version for best compatibility.

## Version Compatibility Table

| Extension Version | ZenML Library Version | Notes |
| ----------------- | --------------------- | ----- |
| 0.0.15            | 0.80.0+               | Latest version with improved project support and stability fixes |
| 0.0.13 - 0.0.14   | 0.80.0+               | Includes Project View and full project management support |
| 0.0.12            | 0.75.0 - 0.79.x       | Supports stack registration and components visualization |
| 0.0.11            | 0.63.0 - 0.74.0       | Includes DAG Visualizer and pipeline run management |
| 0.0.5 - 0.0.10    | 0.55.0 - 0.63.0       | Early versions with basic functionality |

## Installing a Specific Extension Version

If you need to work with an older ZenML version, you can install a compatible extension version using the VS Code UI or the command line:

### Using VS Code UI:
1. Go to the Extensions view (Ctrl+Shift+X)
2. Search for "ZenML"
3. Click the dropdown next to the Install button
4. Select "Install Another Version..."
5. Choose the version that matches your ZenML library version

### Using Command Line:
```bash
# Example for installing version 0.0.11
code --install-extension zenml.zenml-vscode@0.0.11
```

## Upgrading Your ZenML Library

For the best experience, we recommend upgrading your ZenML library to the latest version:

```bash
pip install -U zenml
```

This will allow you to take advantage of all the features available in the latest extension version.
