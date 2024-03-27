# ZenML Extension for Visual Studio Code

![](https://img.shields.io/github/license/zenml-io/vscode-zenml)

![](resources/zenml-extension.gif)

The ZenML VSCode extension seamlessly integrates with the ZenML CLI to enhance your MLOps workflow within VSCode. It is designed to accurately mirror the current state of your ZenML environment within your IDE, ensuring a smooth and integrated experience.

## Features

- **Server, Stacks, and Pipeline Runs Views**: Interact directly with ML stacks, pipeline runs, and server configurations from the Activity Bar.
- **Python Tool Integration**: Utilizes a Language Server Protocol (LSP) server for real-time synchronization with the ZenML environment.
- **Real-Time Configuration Monitoring**: Leverages `watchdog` to dynamically update configurations, keeping the extension in sync with your ZenML setup.
- **Status Bar Indicators**: Display the current stack name and connection status.

## Getting Started

Note that you'll need to have ZenML installed in your Python environment to use
this extension and your Python version needs to be 3.8 or greater.

1. **Install the Extension**: Search for "ZenML" in the VSCode Extensions view (`Ctrl+Shift+X`) and install it.
2. **Connect to ZenML Server**: Use the `ZenML: Connect` command to connect to your ZenML server.
3. **Explore ZenML Views**: Navigate to the ZenML activity bar to access the Server, Stacks, and Pipeline Runs views.

## Using ZenML in VSCode

- **Manage Server Connections**: Connect or disconnect from ZenML servers and refresh server status.
- **Stack Operations**: View stack details, rename, copy, or set active stacks directly from VSCode.
- **Pipeline Runs**: Monitor and manage pipeline runs, including deleting runs from the system.
- **Environment Information**: Get detailed snapshots of the development environment, aiding troubleshooting.

## Requirements

- **ZenML Installation:** ZenML needs to be installed in the local Python environment associated with the Python interpreter selected in the current VS Code workspace. This extension interacts directly with your ZenML environment, so ensuring that ZenML is installed and properly configured is essential.
- **ZenML Version**: To ensure full functionality and compatibility, make sure you have ZenML version 0.55.0 or newer.
- **Python Version**: Python 3.8 or greater is required for the operation of the LSP server, which is a part of this extension.

## Feedback and Contributions

Your feedback and contributions are welcome! Please refer to our [contribution
guidelines](https://github.com/zenml-io/vscode-zenml/CONTRIBUTING.md) for more
information.

For any further questions or issues, please reach out to us in our [Slack
Community](https://zenml.io/slack-invite). To learn more about ZenML,
please visit our [website](https://zenml.io/) and read [our documentation](https://docs.zenml.io).

## License

Apache-2.0

---

ZenML © 2024, ZenML. Released under the [Apache-2.0 License](LICENSE).
