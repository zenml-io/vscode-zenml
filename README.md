# vscode-zenml

VSCode extension for ZenML

# Contributing to the ZenML Visual Studio Extension

This guide will help you set up your environment for development and testing.

## Setting Up Your Development Environment

To contribute to the ZenML Studio extension, you'll need to set up a development environment. This includes forking and cloning the extension repository, and setting up a ZenML starter project for testing purposes.

### 1. Fork the Repository

Go to https://github.com/zenml-io/vscode-zenml and fork the repository to your own GitHub account.

### 2. Clone the Extension Repository

Clone the extension repository to your local machine:

```bash
git clone https://github.com/your-username/vscode-zenml.git
cd vscode-zenml
```

### 3. Set Up a ZenML Starter Project

For testing the extension, you'll need an actual stack to test commands on. For a quick setup, follow the [ZenML "A starter project" guide](https://docs.zenml.io/user-guide/starter-guide/starter-project) to set up a starter project. If you don't have a specific directory structure in mind, consider creating a parent directory with two subdirectories: one for the extension and one for the ZenML starter project.

If you followed the guide, which instructs you to create a `zenml_starter` directory containing the stack, your directory structure will look like this:

```bash
/your-workspace-directory
    /vscode-zenml
    /zenml_starter
```

`vscode-zenml`: The actual extension directory
`zenml_starter`: The stack directory

## Pull Requests

Please follow the guidelines in [CONTRIBUTING.md](https://github.com/zenml-io/zenml/blob/main/CONTRIBUTING.md) from the root `zenml-io` repo.
