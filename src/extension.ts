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
import { EventBus } from './services/EventBus';
import { LSClient } from './services/LSClient';
import { ZenExtension } from './services/ZenExtension';
import { showInformationMessage } from './utils/notifications';
import { refreshUIComponents } from './utils/refresh';
import { ZenServerDetails } from './types/ServerInfoTypes';
import { updateServerUrlAndToken } from './utils/global';

export interface ZenMLReadyNotification {
  ready: boolean;
  version?: string;
}

export async function activate(context: vscode.ExtensionContext) {
  const eventBus = EventBus.getInstance();
  const lsClient = LSClient.getInstance();

  ZenExtension.initialize(context, lsClient);

  eventBus.on('lsClientReady', async (isReady: boolean) => {
    console.log('extension.ts received lsClientReady event:', isReady);
    console.log('---------------------');
    await refreshUIComponents();
  });

  eventBus.on('zenml/ready', async (params: ZenMLReadyNotification) => {
    console.log('extension.ts received zenml/ready notification:', params);
    if (params.ready) {
      showInformationMessage('ZenML Client Available. Refreshing Extension State...');
      await refreshUIComponents();
    }
  });

  eventBus.on('zenml/configUpdated', async (updatedServerConfig: ZenServerDetails) => {
    console.log('extension.ts received zenml/configUpdated event:', updatedServerConfig);
    if (!lsClient.getLanguageClient()) {
      return;
    }
    await updateServerUrlAndToken(updatedServerConfig.storeConfig);
    await refreshUIComponents(updatedServerConfig);
  });
}

/**
 * Deactivates the ZenML extension.
 *
 * @returns {Promise<void>} A promise that resolves to void.
 */
export async function deactivate(): Promise<void> {
  const lsClient = LSClient.getInstance().getLanguageClient();

  if (lsClient) {
    await lsClient.stop();
    EventBus.getInstance().emit('lsClientReady', false);
  }
}
