import * as vscode from "vscode";
import { StackDataProvider } from "../../views/activityBar";
import { ZenMLStatusBar } from "../../views/statusBar";

export const refreshStackView = (stackDataProvider: StackDataProvider) => {
  stackDataProvider.refresh();
  vscode.window.showInformationMessage("Refreshing Stack View...");
};

export const refreshActiveStack = async (statusBar: ZenMLStatusBar) => {
  await statusBar.refreshActiveStack();
  vscode.window.showInformationMessage("Refreshing Active Stack...");
};
