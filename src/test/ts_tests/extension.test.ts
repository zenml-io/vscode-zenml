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
import { MOCK_CONTEXT } from './__mocks__/constants';
import * as extension from '../../extension';
import { ExtensionEnvironment } from '../../services/ExtensionEnvironment';

suite('Extension Activation Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let contextMock: vscode.ExtensionContext;
  let initializeSpy: sinon.SinonSpy;
  let deferredInitializeStub: sinon.SinonSpy;

  setup(() => {
    sandbox = sinon.createSandbox();
    contextMock = MOCK_CONTEXT;
    initializeSpy = sandbox.spy(ExtensionEnvironment, 'initialize');
    deferredInitializeStub = sandbox.stub(ExtensionEnvironment, 'deferredInitialize');
  });

  teardown(() => {
    sandbox.restore();
  });

  test('ZenML Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('zenml-io.zenml'));
  });

  test('activate function behaves as expected', async () => {
    await extension.activate(contextMock);
    sinon.assert.calledOnceWithExactly(initializeSpy, contextMock);
    sinon.assert.calledOnce(deferredInitializeStub);
  });
});
