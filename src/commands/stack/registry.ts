import * as vscode from "vscode";
import { Shell } from "../../utils/Shell";
import { StackDataProvider } from "../../views/activityBar";
import ZenMLStatusBar from "../../views/statusBar";
import { refreshStackView, refreshActiveStack } from ".";

/**
 * Registers stack-related commands for the extension.
 *
 * @param {vscode.ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 * @param {StackDataProvider} stackDataProvider - An instance of StackDataProvider that manages the data and updates the view for stack-related operations.
 */
export function registerStackCommands(
  context: vscode.ExtensionContext,
  shell: Shell,
  stackDataProvider: StackDataProvider,
  statusBar: ZenMLStatusBar
) {
  const refreshStackViewCommand = vscode.commands.registerCommand(
    "zenml.refreshStackView",
    () => refreshStackView(stackDataProvider)
  );

  const refreshActiveStackCommand = vscode.commands.registerCommand(
    "zenml.refreshActiveStack",
    () => refreshActiveStack(statusBar)
  );

  context.subscriptions.push(refreshStackViewCommand, refreshActiveStackCommand);
}
