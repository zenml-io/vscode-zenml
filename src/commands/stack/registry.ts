// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import * as vscode from 'vscode';
import { StackDataProvider, StackTreeItem } from '../../views/activityBar';
import ZenMLStatusBar from '../../views/statusBar';
import {
  refreshStackView,
  refreshActiveStack,
  renameStack,
  setActiveStack,
  copyStack,
} from './cmds';

/**
 * Registers stack-related commands for the extension.
 *
 * @param {vscode.ExtensionContext} context - The context in which the extension operates, used for registering commands and managing their lifecycle.
 * @param {StackDataProvider} stackDataProvider - An instance of StackDataProvider that manages the data and updates the view for stack-related operations.
 * @param {ZenMLStatusBar} statusBar - An instance of ZenMLStatusBar that manages the status bar for the extension.
 */
export function registerStackCommands(
  context: vscode.ExtensionContext,
  stackDataProvider: StackDataProvider,
  statusBar: ZenMLStatusBar
) {
  const refreshStackViewCommand = vscode.commands.registerCommand('zenml.refreshStackView', () =>
    refreshStackView(stackDataProvider)
  );

  const refreshActiveStackCommand = vscode.commands.registerCommand(
    'zenml.refreshActiveStack',
    () => refreshActiveStack(statusBar)
  );

  const renameStackCommand = vscode.commands.registerCommand(
    'zenml.renameStack',
    (node: StackTreeItem) => renameStack(node, stackDataProvider)
  );

  const setActiveStackCommand = vscode.commands.registerCommand(
    'zenml.setActiveStack',
    (node: StackTreeItem) => setActiveStack(context, node, statusBar, stackDataProvider)
  );

  const copyStackCommand = vscode.commands.registerCommand(
    'zenml.copyStack',
    (node: StackTreeItem) => copyStack(node, stackDataProvider)
  );

  context.subscriptions.push(
    refreshStackViewCommand,
    refreshActiveStackCommand,
    renameStackCommand,
    setActiveStackCommand,
    copyStackCommand
  );
}
