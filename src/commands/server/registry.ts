import * as vscode from "vscode";
import { Shell } from "../../utils/Shell";
import { ServerDataProvider } from "../../views/activityBar";
import { connectServer, disconnectServer, refreshServerStatus } from '.';

/**
 * Registers server-related commands for the extension.
 *
 * @param {vscode.ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 * @param {Shell} shell - An instance of Shell that provides access to the shell environment for executing commands.
 * @param {ServerDataProvider} serverDataProvider - An instance of ServerDataProvider that manages the data and updates the view for server-related operations.
 */
export function registerServerCommands(
  context: vscode.ExtensionContext,
  shell: Shell,
  serverDataProvider: ServerDataProvider
) {
  const connectServerCommand = vscode.commands.registerCommand(
    "zenml.connectServer",
    () => connectServer(shell)
  );

  const disconnectServerCommand = vscode.commands.registerCommand(
    "zenml.disconnectServer",
    () => disconnectServer(shell, serverDataProvider)
  );

  const refreshServerStatusCommand = vscode.commands.registerCommand(
    "zenml.refreshServerStatus",
    () => refreshServerStatus(serverDataProvider)
  );

  context.subscriptions.push(
    connectServerCommand,
    disconnectServerCommand,
    refreshServerStatusCommand
  );
}



