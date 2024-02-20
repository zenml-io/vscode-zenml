# vscode-zenml

VSCode extension for ZenML

## Quick Start Guide

Welcome to the VSCode ZenML extension development! This guide is designed to get you up and running quickly with the basics of the extension and how to contribute effectively.

1. **Fork and Clone the Repository**: Start by forking the [zenml-io/vscode-zenml repository](https://github.com/zenml-io/vscode-zenml) to your own GitHub account and clone it to your local machine:

   ```bash
   git clone https://github.com/your-username/vscode-zenml.git
   cd vscode-zenml
   ```

2. **Set Up a ZenML Stack**: You'll need a ZenML stack for testing. Follow the [ZenML Starter Project guide](https://docs.zenml.io/user-guide/starter-guide/starter-project) for a quick setup. Remember, execute ZenML CLI commands outside any virtual environments.

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
