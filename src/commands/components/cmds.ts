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

import { getFlavor, getFlavorsOfType } from '../../common/api';
import { traceError, traceInfo } from '../../common/log/logging';
import { LSClient } from '../../services/LSClient';
import { ComponentTypesResponse, Flavor } from '../../types/StackTypes';
import { ComponentDataProvider } from '../../views/activityBar/componentView/ComponentDataProvider';
import { StackComponentTreeItem } from '../../views/activityBar/componentView/ComponentTreeItems';
import {
  createCommandErrorItem,
  createCommandSuccessItem,
} from '../../views/activityBar/common/ErrorTreeItem';
import ComponentForm from './ComponentsForm';

/**
 * Refreshes the stack component view.
 */
const refreshComponentView = async () => {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
      },
      async () => {
        await ComponentDataProvider.getInstance().refresh();
      }
    );
  } catch (e) {
    const componentProvider = ComponentDataProvider.getInstance();
    componentProvider.showCommandError(
      createCommandErrorItem('refresh component view', `Failed to refresh component view: ${e}`)
    );
    traceError(`Failed to refresh component view: ${e}`);
    console.error(`Failed to refresh component view: ${e}`);
  }
};

/**
 * Allows one to choose a component type and flavor, then opens the component
 * form webview panel to a form specific to register a new a component of that
 * type and flavor.
 */
const registerComponent = async () => {
  const lsClient = LSClient.getInstance();
  try {
    const types = await lsClient.sendLsClientRequest<ComponentTypesResponse>('getComponentTypes');

    if ('error' in types) {
      throw new Error(String(types.error));
    }

    const type = await vscode.window.showQuickPick(types, {
      title: 'What type of component to register?',
    });
    if (!type) {
      return;
    }

    const flavors = await getFlavorsOfType(type);
    if ('error' in flavors) {
      throw flavors.error;
    }

    const flavorNames = flavors.map(flavor => flavor.name);
    const selectedFlavor = await vscode.window.showQuickPick(flavorNames, {
      title: `What flavor of a ${type} component to register?`,
    });
    if (!selectedFlavor) {
      return;
    }

    const flavor = flavors.find(flavor => selectedFlavor === flavor.name);
    await ComponentForm.getInstance().registerForm(flavor as Flavor);
  } catch (e) {
    const componentProvider = ComponentDataProvider.getInstance();
    componentProvider.showCommandError(
      createCommandErrorItem('register component', `Unable to open component form: ${e}`)
    );
    traceError(e);
    console.error(e);
  }
};

const updateComponent = async (node: StackComponentTreeItem) => {
  try {
    const flavor = await getFlavor(node.component.flavor.name);

    await ComponentForm.getInstance().updateForm(
      flavor,
      node.component.name,
      node.component.id,
      node.component.config
    );
  } catch (e) {
    const componentProvider = ComponentDataProvider.getInstance();
    componentProvider.showCommandError(
      createCommandErrorItem('update component', `Unable to open component form: ${e}`)
    );
    traceError(e);
    console.error(e);
  }
};

/**
 * Deletes a specified Stack Component
 * @param {StackComponentTreeItem} node The specified stack component to delete
 */
const deleteComponent = async (node: StackComponentTreeItem) => {
  const lsClient = LSClient.getInstance();

  const answer = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${node.component.name}? This cannot be undone.`,
    { modal: true },
    'Delete'
  );

  if (!answer) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Deleting stack component ${node.component.name}...`,
    },
    async () => {
      try {
        const resp = await lsClient.sendLsClientRequest('deleteComponent', [
          node.component.id,
          node.component.type,
        ]);

        if ('error' in resp) {
          throw resp.error;
        }

        const componentProvider = ComponentDataProvider.getInstance();
        componentProvider.showCommandSuccess(
          createCommandSuccessItem('deleted component', `${node.component.name} deleted`)
        );
        traceInfo(`${node.component.name} deleted`);

        componentProvider.refresh();
      } catch (e) {
        const componentProvider = ComponentDataProvider.getInstance();
        componentProvider.showCommandError(
          createCommandErrorItem('delete component', `Failed to delete component: ${e}`)
        );
        traceError(e);
        console.error(e);
      }
    }
  );
};

export const componentCommands = {
  refreshComponentView,
  registerComponent,
  updateComponent,
  deleteComponent,
};
