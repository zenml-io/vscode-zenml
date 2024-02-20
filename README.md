# vscode-zenml

The ZenML VSCode extension seamlessly integrates with the ZenML CLI to enhance your MLOps workflow within VSCode. It is designed to accurately mirror the current state of your ZenML environment within your IDE, ensuring a smooth and integrated experience.

## Current Features and Limitations

- **CLI Integration**: The extension runs ZenML CLI commands behind the scenes, connecting to whichever environment the CLI is currently linked to.
- **Server Connection**: Currently, the extension does not manage server connections. Users are responsible for establishing or disconnecting from servers as needed. This includes spinning up local servers or connecting to remote ones.
- **Status Bar Updates**: The extension updates the status bar every 30 seconds to display the server status (indicating whether you're connected to a local or remote server) and the currently active stack name. Users can also manually refresh the status to get the latest information.
- **Upcoming Features**: The functionality to display server status in the status bar is part of an upcoming update. We aim to continuously expand the extension's capabilities based on user feedback and evolving needs.

## Quick Start Guide

This guide is designed to get you up and running quickly with the basics of the extension and how to contribute effectively.

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
4. **Set Up a ZenML Stack**: You'll need a ZenML stack for testing. Follow the [ZenML Starter Project guide](https://docs.zenml.io/user-guide/starter-guide/starter-project) for a quick setup. Remember, execute ZenML CLI commands outside any virtual environments.

### Development

- Explore the folder structure to find essential files such as `package.json`, which includes extension metadata and the mapping of commands that appear in the command palette, and `src/extension.ts` for the main logic.
- You can install recommended extensions like `amodio.tsl-problem-matcher`, `ms-vscode.extension-test-runner`, and `dbaeumer.vscode-eslint` for an optimized development experience.
- Press `F5` to open a new window with your extension loaded. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to run your commands.

### Running and Writing Tests

- Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
- Before running any tests, start the "watch" task. This can be done by opening the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and selecting **Tasks: Run Task**. Choose the "watch" task to ensure your tests are continuously monitored and updated as you develop.
- Access the Testing view by clicking on the flask icon in the activity bar or using the hotkey `Ctrl/Cmd + Shift + T`. Within this view, you can initiate your tests by clicking the "Run All Tests" button.
- The outcomes of your tests will be displayed in the Test Results view.
- Make changes to `src/test/extension.test.ts` or create new test files inside the `test` folder.
  - The provided test runner will only consider files matching the name pattern `**.test.ts`.
  - You can create folders inside the `test` folder to structure your tests any way you want.

### Contributing

- Make changes and test them by reloading the extension window or re-launching from the debug toolbar.
- Explore the VS Code API in `node_modules/@types/vscode/index.d.ts` to understand more about what you can do.
- Run and write tests. Ensure the "watch" task is running for continuous test feedback.

### Pull Requests

Contribute back by following our [contribution guidelines](https://github.com/zenml-io/zenml/blob/main/CONTRIBUTING.md).
