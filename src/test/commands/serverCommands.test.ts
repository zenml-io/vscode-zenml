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
import { ServerStatusService } from '../../services/ServerStatusService';
import { ZenMLClient } from '../../services/ZenMLClient';
import sinon from 'sinon';

suite('Server Status Service Test Suite', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    sandbox
      .stub(ZenMLClient.prototype, 'request')
      .callsFake(async (method, endpoint, data, options) => {
        if (endpoint.includes('/info')) {
          return {
            id: 'unique-server-id',
            version: '1.0.0',
            debug: false,
            deployment_type: 'cloud',
            database_type: 'SQLite',
            secrets_store_type: 'Local',
            auth_scheme: 'Basic',
          };
        }
      });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('ServerStatusService correctly fetches server status', async () => {
    const serverStatusService = ServerStatusService.getInstance();
    await serverStatusService.updateStatus();
    const serverStatus = serverStatusService.getCurrentStatus();

    assert.strictEqual(
      serverStatus.isConnected,
      true,
      "Server should be reported as connected due to 'deployment_type' being 'cloud'"
    );
    assert.strictEqual(
      serverStatus.id,
      'unique-server-id',
      'Server ID does not match expected value'
    );
    assert.strictEqual(
      serverStatus.version,
      '1.0.0',
      'Server version does not match expected value'
    );
    assert.strictEqual(
      serverStatus.debug,
      false,
      'Server debug flag does not match expected value'
    );
    assert.strictEqual(
      serverStatus.deployment_type,
      'cloud',
      'Server deployment type does not match expected value'
    );
    assert.strictEqual(
      serverStatus.database_type,
      'SQLite',
      'Server database type does not match expected value'
    );
    assert.strictEqual(
      serverStatus.secrets_store_type,
      'Local',
      'Server secrets store type does not match expected value'
    );
    assert.strictEqual(
      serverStatus.auth_scheme,
      'Basic',
      'Server auth scheme does not match expected value'
    );
  });
});
