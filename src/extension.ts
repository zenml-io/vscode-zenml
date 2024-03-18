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
import { ExtensionEnvironment } from './services/ExtensionEnvironment';
import { LSClient } from './services/LSClient';
import { ZenServerDetails } from './types/ServerInfoTypes'; ``
import { updateServerUrlAndToken } from './utils/global';
import { refreshUIComponents } from './utils/refresh';

export async function activate(context: vscode.ExtensionContext) {
  ExtensionEnvironment.initialize(context);
  ExtensionEnvironment.deferredInitialize();

  const eventBus = EventBus.getInstance();
  eventBus.on('lsClientReady', async (isReady: boolean) => {
    console.log('Language client ready state: ', isReady);
    if (isReady) {
      await refreshUIComponents();
    }
  });

  eventBus.on('serverConfigUpdated', async (updatedServerConfig: ZenServerDetails) => {
    if (!eventBus.lsClientReady) {
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
