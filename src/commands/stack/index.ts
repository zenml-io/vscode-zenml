import * as vscode from "vscode";
import { StackDataProvider } from "../../views/activityBar";
import ZenMLStatusBar from "../../views/statusBar";

/**
 * Refreshes the stack view.
 *
 * @param {StackDataProvider} stackDataProvider - An instance of StackDataProvider that manages the data and updates the view for stack-related operations.
 */
export const refreshStackView = (stackDataProvider: StackDataProvider) => {
  stackDataProvider.refresh();
  vscode.window.showInformationMessage("Refreshing Stack View...");
};

/**
 * Refreshes the active stack.
 *
 * @param {ZenMLStatusBar} statusBar - An instance of ZenMLStatusBar that manages the status bar for the extension.
 */
export const refreshActiveStack = async (statusBar: ZenMLStatusBar) => {
  await statusBar.refreshActiveStack();
  vscode.window.showInformationMessage("Refreshing Active Stack...");
};
