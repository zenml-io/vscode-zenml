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
import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class EnvironmentItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.iconPath = this.determineIcon(label);
  }

  private determineIcon(label: string): { light: string; dark: string } | ThemeIcon | undefined {
    switch (label) {
      case 'global':
      case 'workspace':
        return new ThemeIcon('globe');
      case 'cwd':
        return new ThemeIcon('folder');
      case 'workspace':
        return new ThemeIcon('folder');
      case 'path':
      case 'interpreter':
        const iconName = 'python.png';
        const iconPath = path.join(__dirname, '..', 'resources', iconName);
        return {
          light: iconPath,
          dark: iconPath
        };
      default:
        return undefined;
    }
  }
}
