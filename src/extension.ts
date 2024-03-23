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
import { refreshUIComponents } from './utils/refresh';

export async function activate(context: vscode.ExtensionContext) {
  const eventBus = EventBus.getInstance();
  const lsClient = LSClient.getInstance();

  await ZenExtension.activate(context, lsClient);

  const handleLsClientReady = async (isReady: boolean) => {
    console.log('Extension received lsClientReady notification:', isReady);
    if (isReady && eventBus.zenmlReady) {
      await refreshUIComponents();
    }
  };

  eventBus.on('lsClientReady', handleLsClientReady);

  context.subscriptions.push(
    new vscode.Disposable(() => {
      eventBus.off('lsClientReady', handleLsClientReady);
    })
  );
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
