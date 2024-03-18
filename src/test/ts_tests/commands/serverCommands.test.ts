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
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { serverCommands } from '../../../commands/server/cmds';
import { LSClient } from '../../../services/LSClient';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { EventBus } from '../../../services/EventBus';
import { PYTOOL_MODULE } from '../../../utils/constants';

suite('Server Commands Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let showErrorMessageStub: sinon.SinonStub;
  let mockLSClient: any;
  let mockEventBus = new MockEventBus();
  let emitSpy: sinon.SinonSpy;
  let configurationMock: any;
  let showInputBoxStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockLSClient = new MockLSClient(mockEventBus);
    emitSpy = sandbox.spy(mockEventBus, 'emit');
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    configurationMock = {
      get: sandbox.stub().withArgs('serverUrl').returns('https://zenml.example.com'),
      update: sandbox.stub().resolves(),
      has: sandbox.stub().returns(false),
      inspect: sandbox.stub().returns({ globalValue: undefined }),
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(configurationMock);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('connectServer successfully connects to the server', async () => {
    sandbox
      .stub(mockLSClient.getLanguageClient(), 'sendRequest')
      .withArgs('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.connect`,
        arguments: ['https://zenml.example.com'],
      })
      .resolves({ message: 'Connected successfully', access_token: 'valid_token' });

    const result = await serverCommands.connectServer();

    assert.strictEqual(result, true, 'Should successfully connect to the server');
    sinon.assert.calledOnce(showInputBoxStub);
  });

  test('disconnectServer successfully disconnects from the server', async () => {
    sandbox
      .stub(mockLSClient.getLanguageClient(), 'sendRequest')
      .withArgs('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.disconnect`,
      })
      .resolves({ message: 'Disconnected successfully' });

    await serverCommands.disconnectServer();

    sinon.assert.calledOnceWithExactly(emitSpy, 'refreshServerStatus');
  });

  test('connectServer fails with incorrect URL', async () => {
    sandbox
      .stub(mockLSClient.getLanguageClient(), 'sendRequest')
      .withArgs('workspace/executeCommand', {
        command: `${PYTOOL_MODULE}.connect`,
        arguments: ['invalid.url'],
      })
      .resolves({ error: 'Failed to connect' });

    const result = await serverCommands.connectServer();
    assert.strictEqual(result, false, 'Should fail to connect to the server with incorrect URL');
    sinon.assert.calledOnce(showErrorMessageStub);
  });

  test('refreshServerStatus emits the refresh event', async () => {
    await serverCommands.refreshServerStatus();
    sinon.assert.calledWithExactly(emitSpy, 'refreshServerStatus');
  });
});
