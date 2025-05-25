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

import * as assert from 'assert';
import * as sinon from 'sinon';
import { getPipelineRunDashboardUrl } from '../../../commands/pipelines/utils';
import { ServerDataProvider } from '../../../views/activityBar/serverView/ServerDataProvider';

suite('Pipeline Utils Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockServerDataProvider: any;

  setup(() => {
    sandbox = sinon.createSandbox();

    mockServerDataProvider = {
      getCurrentStatus: sandbox.stub(),
    };

    sandbox.stub(ServerDataProvider, 'getInstance').returns(mockServerDataProvider);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('getPipelineRunDashboardUrl should return empty string for empty id', () => {
    const result = getPipelineRunDashboardUrl('');
    assert.strictEqual(result, '');
  });

  test('getPipelineRunDashboardUrl should return empty string for null server status', () => {
    mockServerDataProvider.getCurrentStatus.returns(null);

    const result = getPipelineRunDashboardUrl('test-run-id');
    assert.strictEqual(result, '');
  });

  test('getPipelineRunDashboardUrl should return empty string for "other" deployment type', () => {
    mockServerDataProvider.getCurrentStatus.returns({
      deployment_type: 'other',
      dashboard_url: 'https://test.com',
    });

    const result = getPipelineRunDashboardUrl('test-run-id');
    assert.strictEqual(result, '');
  });

  test('getPipelineRunDashboardUrl should handle missing dashboard_url', () => {
    mockServerDataProvider.getCurrentStatus.returns({
      deployment_type: 'cloud',
      dashboard_url: null,
      server_url: 'https://server.zenml.cloud',
    });

    const result = getPipelineRunDashboardUrl('test-run-id');
    assert.strictEqual(result, '');
  });

  test('getPipelineRunDashboardUrl should handle undefined dashboard_url', () => {
    mockServerDataProvider.getCurrentStatus.returns({
      deployment_type: 'cloud',
      server_url: 'https://server.zenml.cloud',
    });

    const result = getPipelineRunDashboardUrl('test-run-id');
    assert.strictEqual(result, '');
  });
});
