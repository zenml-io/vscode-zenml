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
import path from 'path';
import { ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class EnvironmentItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
    private readonly customIcon?: string,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    this.iconPath = this.determineIcon(label);
    this.contextValue = contextValue;
  }

  /**
   * Determines the icon for the tree item based on the label.
   *
   * @param label The label of the tree item.
   * @returns The icon for the tree item.
   */
  private determineIcon(label: string): { light: string; dark: string } | ThemeIcon | undefined {
    if (this.customIcon) {
      switch (this.customIcon) {
        case 'check':
          return new ThemeIcon('check', new ThemeColor('gitDecoration.addedResourceForeground'));
        case 'close':
          return new ThemeIcon('close', new ThemeColor('gitDecoration.deletedResourceForeground'));
        case 'error':
          return new ThemeIcon('error', new ThemeColor('errorForeground'));
        default:
          return new ThemeIcon(this.customIcon);
      }
    }
    switch (label) {
      case 'Workspace':
      case 'CWD':
      case 'File System':
        return new ThemeIcon('folder');
      case 'Interpreter':
      case 'Name':
      case 'Python Version':
      case 'Path':
      case 'EnvType':
        const pythonLogo = path.join(__dirname, '..', 'resources', 'python.png');
        return {
          light: pythonLogo,
          dark: pythonLogo,
        };
      case 'ZenML Local':
      case 'ZenML Client':
        const zenmlLogo = path.join(__dirname, '..', 'resources', 'logo.png');
        return {
          light: zenmlLogo,
          dark: zenmlLogo,
        };
      default:
        return undefined;
    }
  }
}
