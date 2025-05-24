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
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { ZenExtension } from '../../../services/ZenExtension';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';

suite('ZenExtension Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);

    // Mock extension context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
      },
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
      },
      extensionUri: vscode.Uri.parse('file:///test'),
      extensionPath: '/test/path',
      asAbsolutePath: sandbox.stub().returnsArg(0),
    } as any;

    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();

    const eventBus = EventBus.getInstance();
    eventBus.cleanupEventListener('lsClientStateChanged');
    eventBus.cleanupEventListener('zenml/clientInitialized');
  });

  test('should have ZenExtension class available', () => {
    sinon.assert.match(typeof ZenExtension, 'function');
    sinon.assert.match(typeof ZenExtension.activate, 'function');
  });

  test('should handle LSClient state changes', () => {
    const mockHandler = sandbox.stub();
    mockEventBus.on('lsClientStateChanged', mockHandler);

    // Simulate LSClient state change
    mockEventBus.emit('lsClientStateChanged', { isReady: true });

    sinon.assert.calledOnce(mockHandler);
    sinon.assert.calledWith(mockHandler, { isReady: true });
  });

  test('should handle extension deactivation', async () => {
    // Should have deactivate method
    sinon.assert.match(typeof ZenExtension.deactivateFeatures, 'function');

    // Should not throw when called
    try {
      await ZenExtension.deactivateFeatures();
      sinon.assert.match(true, true); // Test passes if no error thrown
    } catch (error) {
      sinon.assert.fail(`deactivateFeatures threw an error: ${error}`);
    }
  });

  test('should handle deferred initialization', () => {
    // Should have deferredInitialize method
    sinon.assert.match(typeof ZenExtension.deferredInitialize, 'function');

    // Should not throw when called
    try {
      ZenExtension.deferredInitialize();
      sinon.assert.match(true, true); // Test passes if no error thrown
    } catch (error) {
      sinon.assert.fail(`deferredInitialize threw an error: ${error}`);
    }
  });

  test('should setup views and commands', async () => {
    // Set the context first (this is normally done in activate)
    (ZenExtension as any).context = mockContext;

    // Mock command registration
    sandbox.stub(vscode.commands, 'registerCommand').returns({
      dispose: sandbox.stub(),
    } as any);

    // Mock tree view creation (not registerTreeDataProvider)
    sandbox.stub(vscode.window, 'createTreeView').returns({
      dispose: sandbox.stub(),
    } as any);

    // Should have setupViewsAndCommands method
    sinon.assert.match(typeof ZenExtension.setupViewsAndCommands, 'function');

    await ZenExtension.setupViewsAndCommands();

    // Should register tree views
    sinon.assert.called(vscode.window.createTreeView as sinon.SinonStub);
  });

  test('should manage static properties', () => {
    // Should have static properties
    sinon.assert.match(Array.isArray(ZenExtension.commandDisposables), true);
    sinon.assert.match(Array.isArray(ZenExtension.viewDisposables), true);
  });
});
