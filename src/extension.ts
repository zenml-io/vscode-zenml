import * as vscode from "vscode";
import ZenMLStatusBar from "./views/statusBar";
import { Shell } from "./utils/Shell";
import { ServerDataProvider, StackDataProvider } from "./views/activityBar";
import { registerServerCommands } from "./commands/server/registry";
import { registerStackCommands } from "./commands/stack/registry";

export function activate(context: vscode.ExtensionContext) {
  console.log("ZenML extension is now active!");
  const shell = new Shell();
  const statusBar = ZenMLStatusBar.getInstance(shell);
  const serverDataProvider = new ServerDataProvider(shell);
  const stackDataProvider = new StackDataProvider(shell);

  vscode.window.createTreeView("zenmlServerView", {
    treeDataProvider: serverDataProvider,
  });
  vscode.window.createTreeView("zenmlStackView", {
    treeDataProvider: stackDataProvider,
  });

  registerServerCommands(context, shell, serverDataProvider);
  registerStackCommands(context, shell, stackDataProvider, statusBar);
}

export function deactivate() { }
