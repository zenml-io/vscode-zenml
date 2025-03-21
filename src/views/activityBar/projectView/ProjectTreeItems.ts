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
import * as vscode from 'vscode';
import { Project } from '../../../types/ProjectTypes';
import { TreeItemWithChildren } from '../common/TreeItemWithChildren';

/**
 * A TreeItem for displaying a project detail in the VSCode TreeView.
 */
export class ProjectDetailItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly detail: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.contextValue = 'projectDetail';
  }
}

/**
 * A TreeItem for displaying a project in the VSCode TreeView.
 */
export class ProjectTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  public isActive: boolean;
  public children?: vscode.TreeItem[];

  constructor(
    public readonly project: Project,
    public readonly name: string,
    isActive?: boolean
  ) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = 'project';
    this.isActive = isActive || false;

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    } else {
      this.iconPath = new vscode.ThemeIcon('symbol-method');
    }

    this.id = this.project.id;

    this.createChildrenItems();
  }

  /**
   * Creates child TreeItems for project details.
   */
  private createChildrenItems(): void {
    const createdOn = this.project.created
      ? new Date(this.project.created).toLocaleString()
      : 'N/A';
    const updatedOn = this.project.updated
      ? new Date(this.project.updated).toLocaleString()
      : 'N/A';

    this.children = [
      new ProjectDetailItem('id', this.project.id),
      new ProjectDetailItem('name', this.project.name),
      new ProjectDetailItem('display_name', this.project.display_name || 'N/A'),
      new ProjectDetailItem('created', createdOn),
      new ProjectDetailItem('updated', updatedOn),
    ];
  }

  /**
   * Updates the children items when active status changes.
   */
  public updateChildren(): void {
    this.createChildrenItems();
  }
}
