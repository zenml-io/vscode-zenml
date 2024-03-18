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
import sinon from 'sinon';
import * as vscode from 'vscode';
import {
  copyStack,
  refreshActiveStack,
  renameStack,
} from '../../commands/stack/cmds';
import { ZenMLClient } from '../../services/ZenMLClient';
import { StackDataProvider, StackTreeItem } from '../../views/activityBar';
import ZenMLStatusBar from '../../views/statusBar';
import { Shell } from '../../utils/Shell';
import proxyquire from 'proxyquire';

suite('Stack Commands Test Suite', () => {
  let mockContext: vscode.ExtensionContext;
  let shell: Shell;
  let sandbox: sinon.SinonSandbox;

  let mockApiClient: sinon.SinonStubbedInstance<ZenMLClient>;
  let runPythonScriptStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;
  let updateGlobalStateStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    shell = new Shell();

    runPythonScriptStub = sandbox.stub(Shell.prototype, 'runPythonScript');
    mockApiClient = sandbox.createStubInstance(ZenMLClient);
    sandbox.stub(ZenMLClient, 'getInstance').returns(mockApiClient as unknown as ZenMLClient);

    showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
    updateGlobalStateStub = sandbox.stub().resolves();
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves();

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.parse('file:///extension/path'),
      storagePath: '/path/to/storage',
      globalStoragePath: '/path/to/global/storage',
      logPath: '/path/to/log',
    } as any;
  });

  teardown(() => {
    sandbox.restore();
  });

  test('renameStack successfully renames a stack', async () => {
    const stackId = 'stack-id-123';
    const newStackName = 'New Stack Name';
    mockApiClient.request
      .withArgs('put', `/stacks/${stackId}`, sinon.match.any)
      .resolves({ message: `Stack successfully renamed to ${newStackName}!` });

    showInputBoxStub.resolves(newStackName);

    const stackDataProvider = new StackDataProvider(mockContext);
    await renameStack({ label: 'Old Stack', id: stackId } as any, stackDataProvider);

    sinon.assert.calledOnce(showInputBoxStub);
    assert.strictEqual(
      showInputBoxStub.calledWithExactly({ prompt: 'Enter new stack name' }),
      true
    );
  });

  test('copyStack successfully copies a stack', async () => {
    const sourceStackId = 'stack-id-789';
    const targetStackName = 'Copied Stack';

    mockApiClient.request
      .withArgs('get', `/stacks/${sourceStackId}`)
      .resolves({ id: sourceStackId, name: 'Source Stack' });
    mockApiClient.request
      .withArgs('post', `/workspaces/someWorkspaceId/stacks`, sinon.match.any)
      .resolves({ message: `Stack successfully copied to ${targetStackName}!` });

    showInputBoxStub.resolves(targetStackName);
    const stackDataProvider = new StackDataProvider(mockContext);
    await copyStack({ label: 'Source Stack', id: sourceStackId } as any, stackDataProvider);

    sinon.assert.calledOnce(showInputBoxStub);
    assert.strictEqual(
      showInputBoxStub.calledWithExactly({ prompt: 'Enter the name for the copied stack' }),
      true,
      'Input box was not called with the correct prompt'
    );
  });

  test('refreshActiveStack successfully refreshes the active stack', async () => {
    const expectedActiveStackName = 'Active Stack Name';

    mockApiClient.request
      .withArgs('get', `/stacks/active_stack`)
      .resolves({ name: expectedActiveStackName });

    const statusBarMock = sinon.createStubInstance(ZenMLStatusBar);
    statusBarMock.refreshActiveStack.resolves();

    await refreshActiveStack(statusBarMock);

    sinon.assert.calledOnce(statusBarMock.refreshActiveStack);
  });

  test('setActiveStack successfully switches to a new stack', async () => {
    const node = new StackTreeItem('New Stack', 'new-stack-id', []);
    const statusBarMock = sinon.createStubInstance(ZenMLStatusBar);

    const switchZenMLStackStub = sinon.stub().resolves({ id: node.id, name: node.label });
    const setActiveStack = proxyquire('../../commands/stack/cmds', {
      './utils': { switchZenMLStack: switchZenMLStackStub },
    }).setActiveStack;

    await setActiveStack({ globalState: { update: updateGlobalStateStub } }, node, statusBarMock);

    sinon.assert.calledWithExactly(switchZenMLStackStub, node.id);
    sinon.assert.calledWithExactly(updateGlobalStateStub, 'activeStackId', node.id);
    sinon.assert.calledWithExactly(
      showInformationMessageStub,
      `Active stack set to: ${node.label}`
    );
  });
});
