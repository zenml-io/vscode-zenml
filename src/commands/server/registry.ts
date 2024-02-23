import * as vscode from "vscode";
import { Shell } from "../../utils/Shell";
import { ServerDataProvider } from "../../views/activityBar";
import { connectServer, disconnectServer, refreshServerStatus } from '.';

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



