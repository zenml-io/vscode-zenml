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
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import assert from 'assert';
import { EventBus } from '../../../services/EventBus';
import { ZenServerDetails } from '../../../types/ServerStatusTypes';
import { MOCK_REST_SERVER_DETAILS } from '../__mocks__/constants';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MockEventBus } from '../__mocks__/MockEventBus';

suite('Server Configuration Update Flow Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockEventBus = new MockEventBus();
  let mockLSClientInstance: MockLSClient;
  let mockLSClient: any;
  let refreshUIComponentsStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(vscode.window, 'showInformationMessage');
    refreshUIComponentsStub = sandbox.stub().resolves();

    // Mock LSClient
    mockLSClientInstance = new MockLSClient(mockEventBus);
    mockLSClient = mockLSClientInstance.getLanguageClient();
    sandbox.stub(mockLSClientInstance, 'startLanguageClient').resolves();

    // Mock EventBus
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    mockEventBus.on('lsClientReady', async (isReady: boolean) => {
      if (isReady) {
        await refreshUIComponentsStub();
      }
    });
    mockEventBus.on('serverConfigUpdated', async (updatedServerConfig: ZenServerDetails) => {
      if (mockEventBus.lsClientReady) {
        await refreshUIComponentsStub(updatedServerConfig);
      }
    });
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers()
  });

  test('LSClientReady event triggers UI refresh', async () => {
    mockEventBus.setLsClientReady(true);
    sinon.assert.calledOnce(refreshUIComponentsStub);
  })

  test('MockLSClient triggerNotification works as expected', async () => {
    const mockNotificationType = 'testNotification';
    const mockData = { key: 'value' };
    mockLSClientInstance.mockLanguageClient.onNotification(mockNotificationType, (data: any) => {
      assert.deepStrictEqual(data, mockData);
    });
    mockLSClientInstance.triggerNotification(mockNotificationType, mockData);
  });

  test('ServerConfigUpdated event updates global configuration and refreshes UI', async () => {
    mockLSClientInstance.mockLanguageClient.onNotification('zenml/configUpdated', (data: ZenServerDetails) => {
      assert.deepStrictEqual(data, MOCK_REST_SERVER_DETAILS);
    });

    mockLSClientInstance.triggerNotification('zenml/configUpdated', MOCK_REST_SERVER_DETAILS);

    await new Promise(resolve => setTimeout(resolve, 0));

    sinon.assert.calledOnce(refreshUIComponentsStub);
  });
});
