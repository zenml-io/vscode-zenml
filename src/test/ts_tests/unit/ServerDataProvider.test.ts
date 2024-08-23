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
import * as assert from 'assert';
import * as sinon from 'sinon';
import { serverUtils } from '../../../commands/server/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { ServerDataProvider } from '../../../views/activityBar';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MOCK_REST_SERVER_STATUS, MOCK_SQL_SERVER_STATUS } from '../__mocks__/constants';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { ServerStatus } from '../../../types/ServerInfoTypes';
import { LOADING_TREE_ITEMS } from '../../../views/activityBar/common/LoadingTreeItem';

suite('ServerDataProvider Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockEventBus: MockEventBus;
  let serverDataProvider: ServerDataProvider;
  let mockLSClientInstance: any;
  let mockLSClient: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    serverDataProvider = ServerDataProvider.getInstance();
    mockEventBus = new MockEventBus();
    mockLSClientInstance = MockLSClient.getInstance(mockEventBus);
    mockLSClient = mockLSClientInstance.getLanguageClient();
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClientInstance);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    sandbox.stub(mockLSClientInstance, 'startLanguageClient').resolves();
    serverDataProvider['zenmlClientReady'] = true;
  });

  teardown(() => {
    sandbox.restore();
  });

  test('ServerDataProvider initializes correctly', async () => {
    assert.ok(serverDataProvider);
  });

  test('ServerDataProvider should update server status correctly', async () => {
    sandbox.stub(serverUtils, 'checkServerStatus').callsFake(async () => {
      return Promise.resolve(MOCK_REST_SERVER_STATUS);
    });

    await serverDataProvider.refresh();
    const serverStatus = serverDataProvider.getCurrentStatus() as ServerStatus;

    assert.strictEqual(
      serverStatus.isConnected,
      true,
      'Server should be reported as connected for REST config'
    );
  });

  test('ServerDataProvider should update server status to disconnected for non-REST type', async () => {
    sandbox.restore();

    sandbox.stub(serverUtils, 'checkServerStatus').callsFake(async () => {
      return Promise.resolve(MOCK_SQL_SERVER_STATUS);
    });

    await serverDataProvider.refresh();
    const serverStatus = serverDataProvider.getCurrentStatus() as ServerStatus;

    assert.strictEqual(
      serverStatus.isConnected,
      false,
      'Server should be reported as disconnected for SQL config'
    );
  });
  test('ServerDataProvider should handle zenmlClient not ready state', async () => {
    serverDataProvider['zenmlClientReady'] = false;

    await serverDataProvider.refresh();
    assert.deepStrictEqual(
      serverDataProvider.getCurrentStatus(),
      [LOADING_TREE_ITEMS.get('zenmlClient')!],
      'ServerDataProvider should show loading state for ZenML client not ready'
    );

    serverDataProvider['zenmlClientReady'] = true;
  });
});
