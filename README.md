# vscode-zenml

![](resources/zenml-extension.gif)

The ZenML VSCode extension seamlessly integrates with the ZenML CLI to enhance your MLOps workflow within VSCode. It is designed to accurately mirror the current state of your ZenML environment within your IDE, ensuring a smooth and integrated experience.

## Current Features

- **Activity Bar View**: The Activity Bar view features 'Server', 'Stacks' and 'Pipeline Runs' view containers, making it easier to monitor and interact with ML stacks, pipeline runs, and server configurations directly from VSCode.

- **Python Tool (LSP Server) Integration:** Encapsulates all Python logic for ZenML library interactions and real-time configuration synchronization.

- **Real-Time Configuration Monitoring with Watchdog:** Integrates the `watchdog` library to monitor `config.yaml` for any changes. This enables the extension to dynamically update its configuration in real time and remain synchronized with the user's ZenML environment.

- **Status Bar:** The status bar displays the currently active stack name and connection status with dynamic icons.

## New Additions

- **Environment View**: Provides a detailed snapshot of the development environment, mainly to aid with troubleshooting. It clarifies the Python interpreter setup, ZenML installation, and ZenML Client and LSP client states.

### Server Commands

- `connectServer`: Establishes a connection to the ZenML server (cloud or self-hosted).

- `disconnectServer`: Disconnects from the currently connected ZenML server. Also checks if user is connected to a local zen server and removes it.

- `refreshServerStatus`: Refreshes and updates the server status in the IDE.

### Stack Commands

- `refreshStackView`: Updates the stack view to reflect the latest state.

- `refreshActiveStack`: Refreshes the details of the currently active stack.

- `renameStack`: Allows renaming of an existing stack.

- `copyStack`: Enables duplication of stack configurations.

- `setActiveStack`: Sets a specific stack as the active stack for the project.

### Pipeline Commands

- `refreshPipelineView`: Refreshes the pipeline view to display the current pipeline runs.

- `deletePipelineRun`: Removes a specified pipeline run from the view and system.

### Environment Commands

- `restartLspServer`: Restarts the LSP Server to revalidate ZenML installation and client initialization.

- `setPythonInterpreter`: Opens the command palette for Python interpreter selection and restarts the LSP server upon change.

## Limitations

- **Minimum ZenML Version Requirement:** The extension has been tested and confirmed to work seamlessly from version 0.55.0 up to the latest release. However, compatibility with versions earlier than 0.55.0 has not been tested and cannot be guaranteed for now.

## Quick Start Guide

This guide is designed to get you up and running quickly with the basics of the extension.

1. **Fork the Repository**: Start by forking the [zenml-io/vscode-zenml repository](https://github.com/zenml-io/vscode-zenml) to your own GitHub account.

2. **Clone the Forked Repository**:

```bash

git clone https://github.com/your-username/vscode-zenml.git

```

3. **Install Dependencies**:

```bash

cd vscode-zenml

npm install

```

4. **Compile the project**

```bash
npm run compile
```

### Set Up the Python Environment

Most of the instructions to set up the python side of the extension are [here] [vscode-python-tools-extension-template](https://github.com/microsoft/vscode-python-tools-extension-template?tab=readme-ov-file#getting-started). Follow these steps to set up the Python environment for the extension.

1. Create and activate a Python virtual environment for this project in a terminal. Ensure you are using Python 3.8 or greater:

2. Install `nox` within the activated environment:

```bash

python -m pip install nox

```

3. Initialize your environment with `nox`:

```sh

nox --session setup

```

4. Install dependencies using the generated `requirements.txt` from the previous step

```sh

pip install -r requirements.txt

```

### Usage

To use the extension:

- **Activate** it and navigate to the ZenML tab in the Activity Bar. You'll find:
  1. **Server View**: View server info and connect/disconnect from a ZenML server.
  2. **Stacks View**: Manage stacks and their components (rename, copy, switch).
  3. **Pipeline Runs View**: Monitor pipeline runs and their status, and delete runs as needed.
  4. **Environment View**: Manage your Python environment, switch interpreters, and restart the LSP server for troubleshooting.

Press `F5` to launch the extension (you can also run it from the status bar `Run Extension`).
Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to access these functions via the command palette by searching for `ZenML`.

## Development

**Folder Structure Overview**:

- `package.json`: includes extension metadata and the mapping of commands that appear in the command palette.
- `src`: contains the TypeScript code and `test`
- `src/common`: Largely unchanged from the `vscode-python-tools-extenstion` template. Manages Python interpreter settings, global/workspace configurations, and utilities.
- `src/extension.ts`: The main entry point of the extension, handling activation and deactivation.
- `bundled/tool`: Houses all Python files and logic for the LSP server, with the core functionality in `bundled/tool/lsp_server.py`.

**Recommendations**:

You can install recommended extensions like `amodio.tsl-problem-matcher`, `ms-vscode.extension-test-runner`, and `dbaeumer.vscode-eslint` for an optimized development experience.

### Running and Writing Tests

- Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
- Before running any tests, start the "watch" task. This can be done by opening the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and selecting **Tasks: Run Task**. Choose the "watch" task to ensure your tests are continuously monitored and updated as you develop.
- Access the Testing view by clicking on the flask icon in the activity bar or using the hotkey `Ctrl/Cmd + Shift + T`. Within this view, you can initiate your tests by clicking the "Run All Tests" button.
- The outcomes of your tests will be displayed in the Test Results view.
- Make changes to `src/test/extension.test.ts` or create new test files inside the `test` folder.
- The provided test runner will only consider files matching the name pattern `**.test.ts`.
- You can create folders inside the `test` folder to structure your tests any way you want.

### ZenML Version and Installation:

- ZenML must be installed in the Python environment used by VSCode (versions >= 0.55.0 to 0.56.1).
- The extension attempts automatic ZenML detection and will prompt for a new interpreter if necessary. After a new interpreter selection, allow a few moments for rechecking and server reinitialization.

Re-run `nox --session setup` and `pip install -r requirements.txt` after adjustments to properly reinitialize your environment.

### Troubleshooting

#### Installation and Setup Issues

- Make sure to run `nox --session setup` again if you encounter any setup issues, especially after pulling new changes, followed by `pip install -r requirements.txt`.
- Ensure all dependencies are installed correctly, including any newly added ones.

#### Resetting the Environment

For persistent errors or to start fresh, these various checks and fixes that might help (not necessarily in order):

- **Clear Python Caches**: Remove the `bundled/tool/__pycache__` directory. Then, delete the `dist` directory and recompile with `npm run compile`.
- **Reinitialize Environment**: Delete `.nox` and `bundle/libs`. Then, rerun `nox --session setup` and `pip install -r requirements.txt` to freshen your setup.
- **Restart LSP Server**: If the extension is active but malfunctioning, try restarting the LSP server. From the command palette, select `ZenML – Restart LSP Server`.
- **Debugging Logs**: For insights into issues, check the `OUTPUT` panel in the extension window for LSP server logs. TypeScript-related logs can be found in the `DEBUG CONSOLE` panel of the development window.

### Contributing

- Make changes and test them by reloading the extension window or re-launching from the debug toolbar.
- Explore the VS Code API in `node_modules/@types/vscode/index.d.ts` to understand more about what you can do.
- Run and write tests. Ensure the "watch" task is running for continuous test feedback.

### Pull Requests

Contribute back by following our [contribution guidelines](https://github.com/zenml-io/zenml/blob/main/CONTRIBUTING.md).
