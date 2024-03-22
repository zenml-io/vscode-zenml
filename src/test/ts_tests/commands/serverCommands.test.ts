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
import * as vscode from 'vscode';
import { serverCommands } from '../../../commands/server/cmds';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { refreshUtils } from '../../../utils/refresh';
import { ServerDataProvider } from '../../../views/activityBar';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MOCK_ACCESS_TOKEN, MOCK_REST_SERVER_URL } from '../__mocks__/constants';

suite('Server Commands Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let showErrorMessageStub: sinon.SinonStub;
  let mockLSClient: any;
  let mockEventBus = new MockEventBus();
  let emitSpy: sinon.SinonSpy;
  let configurationMock: any;
  let showInputBoxStub: sinon.SinonStub;
  let refreshUIComponentsStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockLSClient = new MockLSClient(mockEventBus);
    emitSpy = sandbox.spy(mockEventBus, 'emit');
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    configurationMock = {
      get: sandbox.stub().withArgs('serverUrl').returns(MOCK_REST_SERVER_URL),
      update: sandbox.stub().resolves(),
      has: sandbox.stub().returns(false),
      inspect: sandbox.stub().returns({ globalValue: undefined }),
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(configurationMock);
    sandbox.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      const mockProgress = {
        report: sandbox.stub(),
      };
      const mockCancellationToken = new vscode.CancellationTokenSource();
      await task(mockProgress, mockCancellationToken.token);
    });

    refreshUIComponentsStub = sandbox
      .stub(refreshUtils, 'refreshUIComponents')
      .callsFake(async () => {
        console.log('Stubbed refreshUIComponents called');
      });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('connectServer successfully connects to the server', async () => {
    showInputBoxStub.resolves(MOCK_REST_SERVER_URL);
    sandbox
      .stub(mockLSClient, 'sendLsClientRequest')
      .withArgs('connect', [MOCK_REST_SERVER_URL])
      .resolves({
        message: 'Connected successfully',
        access_token: MOCK_ACCESS_TOKEN,
      });

    const result = await serverCommands.connectServer();

    assert.strictEqual(result, true, 'Should successfully connect to the server');
    sinon.assert.calledOnce(showInputBoxStub);
    sinon.assert.calledWith(
      configurationMock.update,
      'serverUrl',
      MOCK_REST_SERVER_URL,
      vscode.ConfigurationTarget.Global
    );
    sinon.assert.calledWith(
      configurationMock.update,
      'accessToken',
      MOCK_ACCESS_TOKEN,
      vscode.ConfigurationTarget.Global
    );
  });

  test('disconnectServer successfully disconnects from the server', async () => {
    sandbox
      .stub(mockLSClient, 'sendLsClientRequest')
      .withArgs('disconnect')
      .resolves({ message: 'Disconnected successfully' });

    await serverCommands.disconnectServer();

    sinon.assert.calledOnce(refreshUIComponentsStub);
  });

  test('connectServer fails with incorrect URL', async () => {
    showInputBoxStub.resolves('invalid.url');
    sandbox
      .stub(mockLSClient, 'sendLsClientRequest')
      .withArgs('connect', ['invalid.url'])
      .rejects(new Error('Failed to connect'));

    const result = await serverCommands.connectServer();
    assert.strictEqual(result, false, 'Should fail to connect to the server with incorrect URL');
    sinon.assert.calledOnce(showErrorMessageStub);
  });

  test('refreshServerStatus refreshes the server status', async () => {
    const serverDataProviderRefreshStub = sandbox
      .stub(ServerDataProvider.getInstance(), 'refresh')
      .resolves();

    await serverCommands.refreshServerStatus();

    sinon.assert.calledOnce(serverDataProviderRefreshStub);
  });
});
