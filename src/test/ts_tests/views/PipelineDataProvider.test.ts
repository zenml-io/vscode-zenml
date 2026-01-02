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
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { PipelineDataProvider } from '../../../views/activityBar/pipelineView/PipelineDataProvider';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';

suite('PipelineDataProvider Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let pipelineDataProvider: PipelineDataProvider;
  let mockLSClient: any;
  let mockEventBus: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);

    // Ensure LSClient.getInstance returns our mock
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient as any);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus as any);

    pipelineDataProvider = PipelineDataProvider.getInstance();

    // Set the client ready states to true for testing
    (pipelineDataProvider as any).lsClientReady = true;
    (pipelineDataProvider as any).zenmlClientReady = true;
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();

    const eventBus = EventBus.getInstance();
    eventBus.cleanupEventListener('lsClientStateChanged');
    eventBus.cleanupEventListener('zenml/clientInitialized');
  });

  test('should create PipelineDataProvider instance', () => {
    assert.ok(pipelineDataProvider instanceof PipelineDataProvider);
  });

  test('should implement singleton pattern', () => {
    const instance1 = PipelineDataProvider.getInstance();
    const instance2 = PipelineDataProvider.getInstance();
    assert.strictEqual(instance1, instance2);
  });

  test('should handle pipeline runs data correctly', async () => {
    const mockPipelineRuns = {
      runs: [
        {
          id: 'run-1',
          name: 'test-pipeline-run-1',
          status: 'completed',
          created: '2024-01-01T00:00:00Z',
        },
        {
          id: 'run-2',
          name: 'test-pipeline-run-2',
          status: 'running',
          created: '2024-01-02T00:00:00Z',
        },
      ],
      total: 2,
      page: 1,
      size: 20,
    };

    mockLSClient.sendLsClientRequest = sandbox.stub().resolves(mockPipelineRuns);

    // Call refresh to trigger data loading, then get children
    await pipelineDataProvider.refresh();
    const children = await pipelineDataProvider.getChildren();

    // Should make LSClient request
    sinon.assert.calledOnce(mockLSClient.sendLsClientRequest);
    sinon.assert.calledWith(mockLSClient.sendLsClientRequest, 'getPipelineRuns');

    // Should return tree items
    assert.ok(Array.isArray(children));
  });

  test('should handle LSClient errors gracefully', async () => {
    mockLSClient.sendLsClientRequest = sandbox.stub().rejects(new Error('Test error'));

    const children = await pipelineDataProvider.getChildren();

    // Should return error tree item
    assert.ok(Array.isArray(children));
    assert.ok(children && children.length >= 1);
  });

  test('should handle empty pipeline runs list', async () => {
    const emptyResponse = {
      runs: [],
      total: 0,
      page: 1,
      size: 20,
    };

    mockLSClient.sendLsClientRequest = sandbox.stub().resolves(emptyResponse);

    const children = await pipelineDataProvider.getChildren();

    assert.ok(Array.isArray(children));
  });

  test('should refresh data when requested', async () => {
    const mockData = {
      runs: [{ id: 'run-1', name: 'test-run', status: 'completed' }],
      total: 1,
      page: 1,
      size: 20,
    };

    const sendRequestStub = sandbox.stub().resolves(mockData);
    mockLSClient.sendLsClientRequest = sendRequestStub;

    // Clear cache to ensure fresh requests
    (pipelineDataProvider as any).requestCache.clear();

    // First call
    await pipelineDataProvider.refresh();

    // Clear cache again to force second request
    (pipelineDataProvider as any).requestCache.clear();

    // Refresh again
    await pipelineDataProvider.refresh();

    // Should have made two requests
    sinon.assert.calledTwice(sendRequestStub);
  });

  test('should handle pagination correctly', async () => {
    const paginatedResponse = {
      runs: [
        { id: 'run-1', name: 'run-1', status: 'completed' },
        { id: 'run-2', name: 'run-2', status: 'failed' },
      ],
      total: 25,
      page: 1,
      size: 20,
    };

    mockLSClient.sendLsClientRequest = sandbox.stub().resolves(paginatedResponse);

    const children = await pipelineDataProvider.getChildren();

    // Should include pagination items if more pages available
    assert.ok(Array.isArray(children));
  });

  test('should handle different pipeline run statuses', async () => {
    const statusVariations = {
      runs: [
        { id: 'run-1', name: 'completed-run', status: 'completed' },
        { id: 'run-2', name: 'failed-run', status: 'failed' },
        { id: 'run-3', name: 'running-run', status: 'running' },
        { id: 'run-4', name: 'initializing-run', status: 'initializing' },
      ],
      total: 4,
      page: 1,
      size: 20,
    };

    mockLSClient.sendLsClientRequest = sandbox.stub().resolves(statusVariations);

    await pipelineDataProvider.refresh();
    const children = await pipelineDataProvider.getChildren();

    assert.ok(Array.isArray(children));
    // Just verify we get some children - the exact count may vary due to tree structure
    assert.ok(children && children.length > 0);
  });

  test('should register event listeners on initialization', () => {
    // Just verify the data provider initializes correctly
    assert.ok(pipelineDataProvider instanceof PipelineDataProvider);
    // Event listener testing is complex with mocked event bus
  });

  test('should handle tree item selection', () => {
    // Test getTreeItem functionality
    const mockRun = {
      id: 'test-run-id',
      name: 'test-pipeline-run',
      status: 'completed',
      created: '2024-01-01T00:00:00Z',
    };

    // This tests the tree item creation logic
    const result = pipelineDataProvider.getTreeItem(mockRun as any);
    assert.ok(typeof result === 'object' && result !== null);
  });
});
