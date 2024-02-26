import * as vscode from "vscode";
import { Shell } from '../../utils/Shell';
import { connectToZenMLServer, disconnectFromZenMLServer } from './utils';
import { ServerDataProvider } from '../../views/activityBar';

/**
 * Initiates a connection to the ZenML server by prompting the user for server details.
 * The function requests the server name, username, and password from the user. If any of these details are missing,
 * it shows an error message. On successful connection, a success message is displayed; otherwise, an error message is shown.
 * 
 * @param {Shell} shell An instance of Shell that provides access to the shell environment for executing commands.
 * @returns {Promise<void>} A promise that resolves to void after the attempt to connect to the server completes. 
 */
const connectServer = async (shell: Shell): Promise<void> => {
  const serverName = await vscode.window.showInputBox({
    prompt: "Enter server name",
  });
  const username = await vscode.window.showInputBox({
    prompt: "Enter username",
  });
  const password = await vscode.window.showInputBox({
    prompt: "Enter password",
    password: true,
  });

  if (!serverName || !username || !password) {
    vscode.window.showErrorMessage(
      "Server name, username, and password are required to connect."
    );
    return;
  }

  const success = await connectToZenMLServer(
    shell,
    serverName,
    username,
    password
  );
  if (success) {
    vscode.window.showInformationMessage(
      "Successfully connected to ZenML server."
    );
  } else {
    vscode.window.showErrorMessage("Failed to connect to ZenML server.");
  }
};

/**
 * Disconnects from the ZenML server and updates the server data provider to reflect this change.
 * This function shows a progress notification while attempting to disconnect. Upon successful disconnection,
 * it displays a success message and refreshes the server data provider to update the UI accordingly. 
 * If the disconnection fails, it shows an error message.
 * 
 * @param {Shell} shell An instance of Shell used to execute the disconnection command.
 * @param {ServerDataProvider} serverDataProvider An instance of ServerDataProvider that manages and updates the server-related view in the UI.
 * @returns {Promise<void>} A promise that resolves to void after the disconnection attempt completes.
 */

const disconnectServer = async (shell: Shell, serverDataProvider: ServerDataProvider) => {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification, title: "Disconnecting from ZenML server...", cancellable: false,
  }, async (progress, token) => {
    const success = await disconnectFromZenMLServer(shell);
    if (success) {
      vscode.window.showInformationMessage("Successfully disconnected from ZenML server.");
      serverDataProvider.refresh();
    } else {
      vscode.window.showErrorMessage("Failed to disconnect from ZenML server.");
    };
  });
};

/**
 * Refreshes the server status display by triggering the server data provider's refresh method.
 * This function also displays an informational message indicating that the server status is being refreshed.
 * 
 * @param {ServerDataProvider} serverDataProvider An instance of ServerDataProvider responsible for managing and updating the server-related UI components.
 * @returns {void} This function does not return a value.
 */
const refreshServerStatus = (serverDataProvider: ServerDataProvider): void => {
  serverDataProvider.refresh();
  vscode.window.showInformationMessage("Refreshing server status...");
};

export { connectServer, disconnectServer, refreshServerStatus };