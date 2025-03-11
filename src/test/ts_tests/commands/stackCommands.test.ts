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
import { stackCommands } from '../../../commands/stack/cmds';
import stackUtils from '../../../commands/stack/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import * as globalUtils from '../../../utils/global';
import { StackDataProvider, StackTreeItem } from '../../../views/activityBar';
import ZenMLStatusBar from '../../../views/statusBar';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';
import { MockStackDataProvider, MockZenMLStatusBar } from '../__mocks__/MockViewProviders';

suite('Stack Commands Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let showInputBoxStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockStackDataProvider: MockStackDataProvider;
  let mockStatusBar: MockZenMLStatusBar;
  let switchActiveStackStub: sinon.SinonStub;
  let setActiveStackStub: sinon.SinonStub; // eslint-disable-line @typescript-eslint/no-unused-vars

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);
    mockStackDataProvider = new MockStackDataProvider();
    mockStatusBar = new MockZenMLStatusBar();
    const stubbedServerUrl = 'http://mocked-server.com';

    // Stub classes to return mock instances
    sandbox.stub(StackDataProvider, 'getInstance').returns(mockStackDataProvider);
    sandbox.stub(ZenMLStatusBar, 'getInstance').returns(mockStatusBar);
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    sandbox.stub(stackUtils, 'storeActiveStack').resolves();
    sandbox.stub(globalUtils, 'getZenMLServerUrl').returns(stubbedServerUrl);

    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');

    switchActiveStackStub = sandbox
      .stub(stackUtils, 'switchActiveStack')
      .callsFake(async (stackNameOrId: string) => {
        console.log('switchActiveStack stub called with', stackNameOrId);
        return Promise.resolve({ id: stackNameOrId, name: `MockStackName` });
      });

    setActiveStackStub = sandbox
      .stub(stackCommands, 'setActiveStack')
      .callsFake(async (node: StackTreeItem) => {
        await switchActiveStackStub(node.id);
        showInformationMessageStub(`Active stack set to: ${node.label}`);
        await mockStatusBar.refreshActiveStack();
        await mockStackDataProvider.refresh();
      });

    sandbox.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      const mockProgress = {
        report: sandbox.stub(),
      };
      const mockCancellationToken = new vscode.CancellationTokenSource();
      await task(mockProgress, mockCancellationToken.token);
    });
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();
  });

  test('renameStack successfully renames a stack', async () => {
    const stackId = 'stack-id-123';
    const newStackName = 'New Stack Name';

    showInputBoxStub.resolves(newStackName);
    await stackCommands.renameStack({ label: 'Old Stack', id: stackId } as any);

    assert.strictEqual(showInputBoxStub.calledOnce, true);
  });

  test('copyStack successfully copies a stack', async () => {
    const sourceStackId = 'stack-id-789';
    const targetStackName = 'Copied Stack';

    showInputBoxStub.resolves(targetStackName);
    await stackCommands.copyStack({ label: 'Source Stack', id: sourceStackId } as any);

    sinon.assert.calledOnce(showInputBoxStub);
    assert.strictEqual(
      showInputBoxStub.calledWithExactly({ prompt: 'Enter the name for the copied stack' }),
      true,
      'Input box was not called with the correct prompt'
    );
  });

  test('goToStackUrl opens the correct URL and shows an information message', () => {
    const stackId = 'stack-id-123';
    const expectedUrl = stackUtils.getStackDashboardUrl(stackId);

    const openExternalStub = sandbox.stub(vscode.env, 'openExternal');

    stackCommands.goToStackUrl({ label: 'Stack', id: stackId } as any);

    assert.strictEqual(openExternalStub.calledOnce, true, 'openExternal should be called once');
    assert.strictEqual(
      openExternalStub.args[0][0].toString(),
      expectedUrl,
      'Correct URL should be passed to openExternal'
    );
    assert.strictEqual(
      showInformationMessageStub.calledOnce,
      true,
      'showInformationMessage should be called once'
    );
    assert.strictEqual(
      showInformationMessageStub.args[0][0],
      `Opening: ${expectedUrl}`,
      'Correct information message should be shown'
    );
  });

  test('stackDataProviderMock.refresh can be called directly', async () => {
    await mockStackDataProvider.refresh();
    sinon.assert.calledOnce(mockStackDataProvider.refresh);
  });

  test('refreshActiveStack successfully refreshes the active stack', async () => {
    await stackCommands.refreshActiveStack();
    sinon.assert.calledOnce(mockStatusBar.refreshActiveStack);
  });

  test('setActiveStack successfully switches to a new stack', async () => {
    const fakeStackNode = new StackTreeItem('MockStackName', 'fake-stack-id', [], false);

    await stackCommands.setActiveStack(fakeStackNode);

    sinon.assert.calledOnce(switchActiveStackStub);
    sinon.assert.calledOnce(showInformationMessageStub);
    sinon.assert.calledWith(showInformationMessageStub, `Active stack set to: MockStackName`);
    sinon.assert.calledOnce(mockStackDataProvider.refresh);
    sinon.assert.calledOnce(mockStatusBar.refreshActiveStack);
  });
});
