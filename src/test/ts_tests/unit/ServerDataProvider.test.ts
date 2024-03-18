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
import { INITIAL_ZENML_SERVER_STATUS } from '../../../utils/constants';
import { ServerDataProvider } from '../../../views/activityBar';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MOCK_REST_SERVER_DETAILS, MOCK_SQL_SERVER_DETAILS } from '../__mocks__/constants';

suite('ServerDataProvider Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockEventBus = new MockEventBus();
  let serverDataProvider: ServerDataProvider;
  let mockLSClient: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockLSClient = new MockLSClient(mockEventBus);
    serverDataProvider = ServerDataProvider.getInstance();
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);

    sandbox.stub(serverUtils, 'checkServerStatus').callsFake(async (updatedServerConfig) => {
      if (updatedServerConfig) {
        return Promise.resolve(serverUtils.createServerStatusFromDetails(updatedServerConfig));
      }
      return INITIAL_ZENML_SERVER_STATUS;
    });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('ServerDataProvider initializes correctly', async () => {
    assert.ok(serverDataProvider);
  });

  test('ServerDataProvider should update server status to connected for REST type', async () => {
    await serverDataProvider.refresh(MOCK_REST_SERVER_DETAILS);
    const serverStatus = serverDataProvider.getCurrentStatus();

    assert.strictEqual(serverStatus.isConnected, true, "Server should be reported as connected for REST config");
    assert.strictEqual(serverStatus.store_type, 'rest', "Store type should be 'rest' for REST config");
  });


  test('ServerDataProvider should update server status to disconnected for non-REST type', async () => {
    await serverDataProvider.refresh(MOCK_SQL_SERVER_DETAILS);
    const serverStatus = serverDataProvider.getCurrentStatus();

    assert.strictEqual(serverStatus.isConnected, false, "Server should be reported as not connected for SQL config");
    assert.strictEqual(serverStatus.store_type, 'sql', "Store type should be 'sql' for SQL config");
  });
});
