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
import * as vscode from 'vscode';
import Panels from '../../../common/panels';
import WebviewBase from '../../../common/WebviewBase';
import DagRenderer from '../../../dag/renderer/DagRenderer';
import { IconLoader } from '../../../dag/utils/IconLoader';
import { LSClient } from '../../../services/LSClient';
import { ServerDataProvider } from '../../../views/activityBar/serverView/ServerDataProvider';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';

suite('DagRenderer Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockWebviewPanel: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);

    // Mock extension context for WebviewBase
    const mockExtensionContext = {
      extensionUri: vscode.Uri.file('/mock/extension/path'),
      extensionPath: '/mock/extension/path',
    } as vscode.ExtensionContext;
    WebviewBase.setContext(mockExtensionContext);

    // Stub icon loading and SVG lib to prevent file system warnings
    sandbox.stub(IconLoader.prototype, 'loadIcons').resolves({});
    sandbox.stub(DagRenderer.prototype, 'loadSvgWindowLib' as any).returns(undefined);

    // Mock webview panel
    mockWebviewPanel = {
      webview: {
        html: '',
        cspSource: 'vscode-webview:',
        asWebviewUri: sandbox.stub().returns(vscode.Uri.parse('vscode-webview://fake-uri')),
        onDidReceiveMessage: sandbox.stub(),
        postMessage: sandbox.stub().resolves(),
      },
      onDidDispose: sandbox.stub(),
      onDidChangeViewState: sandbox.stub(),
      reveal: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    // Mock server status
    const mockServerStatus = {
      dashboard_url: 'https://test-dashboard.com',
      deployment_type: 'cloud',
      server_url: 'https://test-server.com',
    };

    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(ServerDataProvider, 'getInstance').returns({
      getCurrentStatus: sandbox.stub().returns(mockServerStatus),
    } as any);

    // Mock Panels singleton
    const mockPanels = {
      getPanel: sandbox.stub().returns(null), // No existing panel
      createPanel: sandbox.stub().returns(mockWebviewPanel),
    };
    sandbox.stub(Panels, 'getInstance').returns(mockPanels as any);
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();
  });

  test('should create DagRenderer instance', () => {
    const dagRenderer = new DagRenderer();
    assert.ok(dagRenderer instanceof DagRenderer);
  });

  test('should have working getInstance method', () => {
    const instance1 = DagRenderer.getInstance();
    const instance2 = DagRenderer.getInstance();
    assert.strictEqual(instance1, instance2);
    assert.ok(instance1 instanceof DagRenderer);
  });
});
