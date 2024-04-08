# Contributing to ZenML VSCode Extension

We appreciate your interest in contributing to the ZenML VSCode extension! This guide will help you get started with setting up your development environment, making changes, and proposing those changes back to the project. By following these guidelines, you'll ensure a smooth and efficient contribution process.

## Setting Up Your Development Environment

1. **Fork and Clone**: Fork the [zenml-io/vscode-zenml repository](https://github.com/zenml-io/vscode-zenml) and clone it to your local machine.

```bash
git clone https://github.com/YOUR_USERNAME/vscode-zenml.git
git checkout develop
```

2. **Install Dependencies**: Navigate to the cloned repository directory and install the required dependencies.

```bash
cd vscode-zenml
npm install
```

3. **Compile the Project**: Build the TypeScript source code into JavaScript.

```bash
npm run compile
```

### Python Environment Setup

The extension's Python functionality requires setting up a corresponding Python environment.

1. Create and activate a Python virtual environment using Python 3.8 or greater. (e.g., `python -m venv .venv` on Windows, or `python3 -m venv .venv` on Unix-based systems).
2. Install `nox` for environment management.

```bash
python -m pip install nox
```

3. Use `nox` to set up the environment.

```bash
nox --session setup
```

4. Install any Python dependencies specified in `requirements.txt`.

```bash
pip install -r requirements.txt
```

## Development Workflow

- **Running the Extension**: Press `F5` to open a new VSCode window with the
  extension running, or click the `Start Debugging` button in the VSCode menubar
  under the `Run` menu.
- **Making Changes**: Edit the source code. The TypeScript code is in the `src` directory, and Python logic for the LSP server is in `bundled/tool`.

### Testing

- **Writing Tests**: Add tests in the `src/test` directory. Follow the naming convention `*.test.ts` for test files.
- **Running Tests**: Use the provided npm scripts to compile and run tests.

```bash
npm run test
```

### Debugging

- **VSCode Debug Console**: Utilize the debug console in the VSCode development window for troubleshooting and inspecting values.
- **Extension Host Logs**: Review the extension host logs for runtime errors or unexpected behavior.

## Contributing Changes

1. **Create a Branch**: Make your changes in a new git branch based on the `develop` branch.

```bash
git checkout -b feature/your-feature-name
```

2. **Commit Your Changes**: Write clear, concise commit messages following the [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) guidelines.
3. **Push to Your Fork**: Push your branch to your fork on GitHub.

```bash
git push origin feature/your-feature-name
```

4. **Open a Pull Request**: Go to the original `zenml-io/vscode-zenml` repository and create a pull request from your feature branch. Please follow our [contribution guidelines](https://github.com/zenml-io/zenml/blob/develop/CONTRIBUTING.md) for more details on proposing pull requests.

## Release Process

The ZenML VSCode extension uses a GitHub Actions workflow defined in `.github/workflows/release.yml` to automate the release process when a new tag is pushed to the repository.

To create a new release:

1. Ensure that your changes have been merged into the main branch.
2. Create a new tag following the SemVer format (e.g., `v1.0.0`).
3. Push the tag to the zenml-io/vscode-zenml repository.

```bash
git tag v1.0.0
git push origin v1.0.0
```

The `release.yml` workflow will automatically trigger, package the extension, and publish it to the Visual Studio Marketplace.

## Troubleshooting Common Issues

- Ensure all dependencies are up to date and compatible.
- Rebuild the project (`npm run compile`) after making changes.
- Reset your development environment if encountering persistent issues by re-running `nox` setup commands and reinstalling dependencies.
- You can also run the `scripts/clear_and_compile.sh` script, which will delete the cache, `dist` folder, and recompile automatically.
- Check the [ZenML documentation](https://docs.zenml.io) and [GitHub issues](https://github.com/zenml-io/zenml/issues) for common problems and solutions.

### Additional Resources

- [ZenML VSCode Extension Repository](https://github.com/zenml-io/vscode-zenml)
- [ZenML Documentation](https://docs.zenml.io)
- [ZenML Slack Community](https://zenml.io/slack)
