import * as vscode from "vscode";
import { Shell } from '../../utils/Shell';
import { connectToZenMLServer, disconnectFromZenMLServer } from './utils';
import { ServerDataProvider } from '../../views/activityBar';

const connectServer = async (shell: Shell) => {
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
}

const disconnectServer = async (shell: Shell, serverDataProvider: ServerDataProvider) => {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification, title: "Disconnecting from ZenML server...", cancellable: false,
  }, async (progress, token) => {
    const success = await disconnectFromZenMLServer(shell);
    if (success) {
      vscode.window.showInformationMessage("Successfully disconnected from ZenML server.");
      serverDataProvider.refresh();
    } else {
      vscode.window.showErrorMessage("Failed to disconnect from ZenML server.")
    };
  });
}

const refreshServerStatus = (serverDataProvider: ServerDataProvider) => {
  serverDataProvider.refresh();
  vscode.window.showInformationMessage("Refreshing server status...");
}

export { connectServer, disconnectServer, refreshServerStatus }