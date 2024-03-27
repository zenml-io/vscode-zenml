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
import { ThemeIcon, TreeItem } from 'vscode';

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
    this.iconPath = new ThemeIcon('error');
  }
}

export class VersionMismatchTreeItem extends ErrorTreeItem {
  constructor(clientVersion: string, serverVersion: string) {
    super(`Version mismatch detected`, `Client: ${clientVersion} – Server: ${serverVersion}`);
    this.iconPath = new ThemeIcon('warning');
  }
}

export const createErrorItem = (error: any): TreeItem[] => {
  const errorItems: TreeItem[] = [];
  console.log('Creating error item', error);
  if (error.clientVersion || error.serverVersion) {
    errorItems.push(new VersionMismatchTreeItem(error.clientVersion, error.serverVersion));
  }
  errorItems.push(new ErrorTreeItem(error.errorType || 'Error', error.message));
  return errorItems;
};
