# ZenML Extension for Visual Studio Code

![](https://img.shields.io/github/license/zenml-io/vscode-zenml)

<div>
  <img src="resources/zenml-extension-new.gif" alt="ZenML Extension" width="60%">
</div>

The ZenML VSCode extension seamlessly integrates with [ZenML](https://github.com/zenml-io/zenml) to enhance your MLOps workflow within VSCode. It is designed to accurately mirror the current state of your ZenML environment within your IDE, ensuring a smooth and integrated experience.

## Features

- **Server, Projects, Stacks, and Pipeline Runs Views**: Interact directly with ML stacks, pipeline runs, and server configurations from the Activity Bar.
- **Project Management**: Explore, switch between, and manage your ZenML projects directly from the Activity Bar.
- **DAG Visualization for Pipeline Runs**: Explore Directed Acyclic Graphs for each pipeline view directly on the Activity Bar.
- **Python Tool Integration**: Utilizes a Language Server Protocol (LSP) server for real-time synchronization with the ZenML environment.
- **Real-Time Configuration Monitoring**: Leverages `watchdog` to dynamically update configurations, keeping the extension in sync with your ZenML setup.
- **Status Bar**: View your active stack, project, and connection status at a glance. You can also quickly switch between stacks or projects directly from the status bar.

## Getting Started

Note that you'll need to have [ZenML](https://github.com/zenml-io/zenml) installed in your Python environment to use
this extension and your Python version needs to be 3.8 or greater.

1. **Install the Extension**: Search for "ZenML" in the VSCode Extensions view (`Ctrl+Shift+X`) and install it.
2. **Connect to ZenML Server**: Use the `ZenML: Connect` command to connect to your ZenML server.
3. **Explore ZenML Views**: Navigate to the ZenML activity bar to access the Server, Stacks, and Pipeline Runs views.

## Using ZenML in VSCode

- **Manage Server Connections**: Connect or disconnect from ZenML servers and refresh server status.
- **Project Operations**: Browse available projects, view project details, set active projects, and refresh project information.
- **Stack Operations**: View stack details, register, update, delete, copy, or set active stacks directly from VSCode.
- **Stack Component Operations**: View stack component details, register, update, or delete stack components directly from VSCode.
- **Pipeline Runs**: Monitor and manage pipeline runs, including deleting runs from the system and rendering DAGs.
- **Environment Information**: Get detailed snapshots of the development environment, aiding troubleshooting.

### DAG Visualization

![DAG Visualization Example](resources/zenml-extension-dag.gif)

- **Directed Acyclic Graph rendering**
  - click on the Render Dag context action (labeled 1 in above image) next to the pipeline run you want to render. This will render the DAG in the editor window.
- **Graph manuevering**
  - Panning the graph can be done by clicking and dragging anywhere on the graph.
  - Zooming can be controlled by the mousewheel, the control panel (labeled 2 in the above graph) or double-clicking anywhere there is not a node.
  - Mousing over a node will highlight all edges being output by that node
  - Clicking a node will display the data related to it in the ZenML panel view (labeled 3 in the above image)
  - Double-clicking a node will open the dashboard in a web browser to either the pipeline run or the artifact version.

## Requirements

- **ZenML Installation:** ZenML needs to be installed in the local Python environment associated with the Python interpreter selected in the current VS Code workspace. This extension interacts directly with your ZenML environment, so ensuring that ZenML is installed and properly configured is essential.
- **ZenML Version**: This extension is compatible with ZenML version 0.80.0 or newer. For older ZenML versions, see our [version compatibility guide](VERSIONS.md) to install the appropriate extension version.
- **Python Version**: Python 3.8 or greater is required for the operation of the LSP server, which is a part of this extension.

## Feedback and Contributions

Your feedback and contributions are welcome! Please refer to our [contribution
guidelines](https://github.com/zenml-io/vscode-zenml/blob/develop/CONTRIBUTING.md) for more
information.

For any further questions or issues, please reach out to us in our [Slack
Community](https://zenml.io/slack-invite). To learn more about ZenML,
please visit our [website](https://zenml.io/) and read [our documentation](https://docs.zenml.io).

## License

Apache-2.0

---

ZenML © 2024, ZenML. Released under the [Apache-2.0 License](LICENSE).
