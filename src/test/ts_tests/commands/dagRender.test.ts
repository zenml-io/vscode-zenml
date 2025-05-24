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
import DagRenderer from '../../../commands/pipelines/DagRender';
import Panels from '../../../common/panels';
import WebviewBase from '../../../common/WebviewBase';
import { LSClient } from '../../../services/LSClient';
import { PipelineTreeItem } from '../../../views/activityBar/pipelineView/PipelineTreeItems';
import { ServerDataProvider } from '../../../views/activityBar/serverView/ServerDataProvider';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';

suite('DagRenderer Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockWebviewPanel: any;
  let mockPipelineTreeItem: PipelineTreeItem;

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

    // Mock pipeline tree item
    mockPipelineTreeItem = {
      id: 'test-pipeline-id',
      label: 'Test Pipeline',
      contextValue: 'pipelineRun',
    } as PipelineTreeItem;

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
    sinon.assert.match(dagRenderer, sinon.match.instanceOf(DagRenderer));
  });

  test('escapeHtml should properly escape HTML characters', () => {
    const testCases = [
      {
        input: '<script>alert("xss")</script>',
        expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      },
      { input: 'Hello & World', expected: 'Hello &amp; World' },
      { input: "Single 'quotes'", expected: 'Single &#x27;quotes&#x27;' },
      { input: 'Normal text', expected: 'Normal text' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = (DagRenderer as any).escapeHtml(input);
      sinon.assert.match(result, expected);
    });
  });

  test('should generate correct empty state HTML with escaped content', () => {
    const dagRenderer = new DagRenderer();
    const testContent = {
      cssUri: vscode.Uri.parse('test://css'),
      jsUri: vscode.Uri.parse('test://js'),
      message: '<script>alert("xss")</script>',
      pipelineName: 'Test & Pipeline',
      status: 'failed',
      cspSource: 'vscode-webview:',
    };

    const html = (dagRenderer as any).getNoStepsContent(testContent);

    // Should contain escaped content
    sinon.assert.match(html, /Test &amp; Pipeline/);
    sinon.assert.match(html, /&lt;script&gt;/);

    // Should not contain unescaped HTML
    sinon.assert.match(
      html,
      sinon.match(content => !content.includes('<script>alert'))
    );
  });
});
