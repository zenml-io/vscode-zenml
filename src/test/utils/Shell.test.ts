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
import { strict as assert } from 'assert';
import { Shell } from '../../utils/Shell';
import sinon from 'sinon';
import * as vscode from 'vscode';

let getConfigurationStub: sinon.SinonStub;
let showInputBoxStub: sinon.SinonStub;

class MockShell extends Shell {
  runPythonScript(scriptPath: string, args: string[] = []): Promise<any> {
    if (scriptPath === 'valid_script.py') {
      return Promise.resolve(JSON.stringify({ key: 'mocked_value' }));
    } else {
      return Promise.reject(new Error('Mocked error'));
    }
  }

  public executeCommand(command: string): Promise<string> {
    return super.executeCommand(command);
  }
}

suite('Shell Class Test Suite', () => {
  let shell: MockShell;
  let executeCommandStub: sinon.SinonStub;

  setup(() => {
    shell = new MockShell();
    executeCommandStub = sinon.stub(shell, 'executeCommand');

    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined,
      update: sinon.stub().resolves(),
    } as any);

    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
  });

  teardown(() => {
    sinon.restore();
  });

  test('checkZenMLInstallation returns false when not installed', async () => {
    executeCommandStub.rejects(new Error('ZenML not found'));

    const isInstalled = await shell.checkZenMLInstallation();

    assert.strictEqual(isInstalled, false, 'ZenML should not be detected as installed');
  });

  test('promptForVenvPath updates the configuration with the provided path', async () => {
    const mockedPath = '/mocked/path/to/zenml_venv';
    showInputBoxStub.resolves(mockedPath);
    const shell = new MockShell();
    await shell.promptForVenvPath();

    assert.ok(
      getConfigurationStub.calledWith('zenml'),
      'promptForVenvPath should update the configuration'
    );

    assert.strictEqual(
      shell.venvPath,
      mockedPath,
      'Shell instance venvPath should be updated with the provided path'
    );
  });

  test('runPythonScript uses the venv path when provided', async () => {
    getConfigurationStub.returns({
      get: () => '/mocked_path_to/zenml_venv',
      update: sinon.stub().resolves(),
    } as any);

    const shell = new MockShell();
    const result = await shell.runPythonScript('valid_script.py');
    assert.strictEqual(
      result,
      JSON.stringify({ key: 'mocked_value' }),
      'runPythonScript should return the expected value'
    );
  });
});
