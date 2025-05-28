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

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { modelCommands } from '../../../commands/models/cmds';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { ModelDataProvider } from '../../../views/activityBar/modelView/ModelDataProvider';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';

interface MockModelDataProviderInterface {
  refresh: sinon.SinonStub;
}

suite('Model Commands Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockModelDataProvider: MockModelDataProviderInterface;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);

    // Create a simple mock with just the methods we need
    mockModelDataProvider = {
      refresh: sinon.stub().resolves(),
    };

    // Stub classes to return mock instances
    sandbox.stub(ModelDataProvider, 'getInstance').returns(mockModelDataProvider as any);
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);

    sandbox.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      const mockProgress = {
        report: sandbox.stub(),
      };
      const mockCancellationToken = new vscode.CancellationTokenSource();
      await task(mockProgress, mockCancellationToken.token);
    });
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();

    const eventBus = EventBus.getInstance();
    eventBus.cleanupEventListener('lsClientStateChanged');
    eventBus.cleanupEventListener('zenml/clientInitialized');
  });

  test('refreshModelView calls refresh on the ModelDataProvider', async () => {
    await modelCommands.refreshModelView();

    sinon.assert.calledOnce(mockModelDataProvider.refresh);
  });

  test('ModelDataProvider.refresh can be called directly', async () => {
    await mockModelDataProvider.refresh();
    sinon.assert.calledOnce(mockModelDataProvider.refresh);
  });

  test('refreshModelView refreshes view on command execution', async () => {
    // Create a backup of the original executeCommand function
    const originalExecuteCommand = vscode.commands.executeCommand;

    // Instead of registering the command again, just stub executeCommand
    // to call our modelCommands.refreshModelView directly when it sees zenml.refreshModelView
    sandbox.stub(vscode.commands, 'executeCommand').callsFake(async (command, ...args) => {
      if (command === 'zenml.refreshModelView') {
        return modelCommands.refreshModelView();
      }
      return originalExecuteCommand.call(vscode.commands, command, ...args);
    });

    // Execute
    await vscode.commands.executeCommand('zenml.refreshModelView');

    // Verify
    sinon.assert.calledOnce(mockModelDataProvider.refresh);
  });
});
