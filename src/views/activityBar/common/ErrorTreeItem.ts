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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.
import { ThemeColor, ThemeIcon, TreeItem } from 'vscode';

export interface GenericErrorTreeItem {
  label: string;
  description: string;
  message?: string;
  icon?: string;
}

export type ErrorTreeItemType = VersionMismatchTreeItem | ErrorTreeItem;

export class ErrorTreeItem extends TreeItem {
  constructor(label: string, description: string) {
    super(label);
    this.description = description;
    this.iconPath = new ThemeIcon('warning', new ThemeColor('charts.yellow'));
  }
}

export class VersionMismatchTreeItem extends ErrorTreeItem {
  constructor(clientVersion: string, serverVersion: string) {
    super(`Version mismatch detected`, `Client: ${clientVersion} – Server: ${serverVersion}`);
    this.iconPath = new ThemeIcon('warning', new ThemeColor('charts.yellow'));
  }
}

/**
 * Creates an error item for the given error.
 *
 * @param error The error to create an item for.
 * @returns The error tree item(s).
 */
export const createErrorItem = (error: any): TreeItem[] => {
  const errorItems: TreeItem[] = [];
  if (error.clientVersion || (error.serverVersion && error.serverVersion !== 'N/A')) {
    errorItems.push(new VersionMismatchTreeItem(error.clientVersion, error.serverVersion));
  }
  errorItems.push(new ErrorTreeItem(error.errorType || 'Error', error.message));
  return errorItems;
};

/**
 * Creates an error item for authentication errors.
 *
 * @param errorMessage The error message to parse.
 * @returns The error tree item(s),
 */
export const createAuthErrorItem = (errorMessage: string): ErrorTreeItem[] => {
  const parts = errorMessage.split(':').map(part => part.trim());
  let [, detailedError, actionSuggestion] = ['', '', ''];

  if (parts.length > 2) {
    // generalError = parts[0]; // "Failed to retrieve pipeline runs" – commented out (unused for now)
    detailedError = `${parts[1]}: ${(parts[2].split('.')[0] || '').trim()}`; // "Authentication error: error decoding access token"
    actionSuggestion = (parts[2].split('. ')[1] || '').trim(); // "You may need to rerun zenml connect"
  }

  const errorItems: ErrorTreeItem[] = [];
  if (detailedError) {
    errorItems.push(new ErrorTreeItem(parts[1], detailedError.split(':')[1].trim()));
  }
  if (actionSuggestion) {
    errorItems.push(new ErrorTreeItem(actionSuggestion, ''));
  }
  return errorItems;
};
