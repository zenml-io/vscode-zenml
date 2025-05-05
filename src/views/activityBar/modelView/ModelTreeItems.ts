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
import { Model, ModelVersion } from '../../../types/ModelTypes';
import {
  CONTEXT_VALUES,
  MODEL_VERSION_SECTION_ICONS,
  MODEL_VERSION_STATUS_ICONS,
  TREE_ICONS,
} from '../../../utils/ui-constants';
import { TreeItemWithChildren } from '../common/TreeItemWithChildren';

/**
 * Represents a Model Tree Item in the VS Code tree view.
 * Displays information about a model in the model registry.
 */
export class ModelTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  constructor(
    public readonly model: Model,
    public readonly id: string,
    public readonly description: string = '',
    public readonly contextValue: string = CONTEXT_VALUES.MODEL
  ) {
    super(model.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `Model: ${model.name}${model.latest_version_name ? ` (Latest version: ${model.latest_version_name})` : ''}`;
    this.description = description;
    this.iconPath = TREE_ICONS.MODEL;
  }
}

/**
 * Represents a Model Version Tree Item in the VS Code tree view.
 * Displays information about a specific version of a model.
 */
export class ModelVersionTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  constructor(
    public readonly version: ModelVersion,
    public readonly description: string = '',
    public readonly contextValue: string = CONTEXT_VALUES.MODEL_VERSION
  ) {
    super(`${version.name}`, vscode.TreeItemCollapsibleState.Collapsed);

    // For description, show version number and stage if available
    const stagePart = version.stage ? ` (${version.stage})` : '';
    this.description = `${stagePart}`;
    this.iconPath = MODEL_VERSION_STATUS_ICONS[version.stage || 'Not set'];

    this.tooltip = `Model Version: ${version.name}
Number: ${version.number}
Stage: ${version.stage || 'Not set'}
Created: ${new Date(version.created).toLocaleString()}
Updated: ${new Date(version.updated).toLocaleString()}`;
  }
}

/**
 * Represents a detail item for a model or model version in the tree view.
 */
export class ModelDetailTreeItem extends vscode.TreeItem {
  public children?: ModelDetailTreeItem[];

  constructor(
    public readonly label: string,
    public readonly description: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly contextValue: string = CONTEXT_VALUES.MODEL_DETAIL
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.contextValue = contextValue;
    this.tooltip = `${label}: ${description}`;
  }
}

/**
 * Represents a section for grouping model version details.
 */
export class ModelSectionTreeItem extends vscode.TreeItem implements TreeItemWithChildren {
  public children?: vscode.TreeItem[];

  constructor(
    public readonly label: string,
    children: vscode.TreeItem[] = []
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = children;
    this.contextValue = CONTEXT_VALUES.MODEL_SECTION;
    this.iconPath = MODEL_VERSION_SECTION_ICONS[label];
  }
}
