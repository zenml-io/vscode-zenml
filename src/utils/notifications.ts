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

/**
 * Shows an information message in the status bar for a specified duration.
 *
 * @param message The message to show.
 * @param duration Duration in milliseconds after which the message will disappear.
 */
export const showStatusBarInfoMessage = (message: string, duration: number = 5000): void => {
  const disposable = vscode.window.setStatusBarMessage(message);
  setTimeout(() => disposable.dispose(), duration);
};

/**
 * Shows a warning message in the status bar for a specified duration.
 *
 * @param message The message to show.
 * @param duration Duration in milliseconds after which the message will disappear.
 */
export const showStatusBarWarningMessage = (message: string, duration: number = 5000): void => {
  const disposable = vscode.window.setStatusBarMessage(`$(alert) ${message}`);
  setTimeout(() => disposable.dispose(), duration);
};

/**
 * Shows an error message in the status bar for a specified duration.
 *
 * @param message The message to show.
 * @param duration Duration in milliseconds after which the message will disappear.
 */
export const showStatusBarErrorMessage = (message: string, duration: number = 5000): void => {
  const disposable = vscode.window.setStatusBarMessage(`$(error) ${message}`);
  setTimeout(() => disposable.dispose(), duration);
};

/**
 * Shows a modal pop up information message.
 *
 * @param message The message to display.
 */
export const showInformationMessage = (message: string): void => {
  vscode.window.showInformationMessage(message);
};

/**
 * Shows a modal pop up error message,
 *
 * @param message The message to display.
 */
export const showErrorMessage = (message: string): void => {
  vscode.window.showErrorMessage(message);
};

/**
 * Shows a warning message with actions (buttons) for the user to select.
 *
 * @param message The warning message to display.
 * @param actions An array of actions, each action being an object with a title and an action callback.
 */
export async function showWarningMessageWithActions(
  message: string,
  ...actions: { title: string; action: () => void | Promise<void> }[]
): Promise<void> {
  // Map actions to their titles to display as buttons.
  const items = actions.map(action => action.title);

  // Show warning message with buttons.
  const selection = await vscode.window.showWarningMessage(message, ...items);

  // Find the selected action based on the title and execute its callback.
  const selectedAction = actions.find(action => action.title === selection);
  if (selectedAction) {
    await selectedAction.action();
  }
}
