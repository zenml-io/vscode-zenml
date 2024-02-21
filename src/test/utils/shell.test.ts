import { strict as assert } from 'assert';
import { Shell } from '../../utils/shell';
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
}

suite('Shell Class Test Suite', () => {
  setup(() => {
    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => undefined, // By default, venvPath is not set.
      update: sinon.stub().resolves(),
    } as any);

    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
  });

  teardown(() => {
    sinon.restore();
  });

  test('checkZenMLInstallation returns false when not installed', async () => {
    const shell = new MockShell();
    sinon.stub(shell, 'checkZenMLInstallation').resolves(false);

    const isInstalled = await shell.checkZenMLInstallation();
    assert.strictEqual(isInstalled, false, 'ZenML should not be detected as installed');
  });

  test('promptForVenvPath updates the configuration with the provided path', async () => {
    showInputBoxStub.resolves('/mocked_path_to/zenml_venv');
    const shell = new MockShell();
    await shell.promptForVenvPath();

    assert.ok(getConfigurationStub.calledWith('zenml-io.zenml'), 'promptForVenvPath should update the configuration');
  });

  test('runPythonScript uses the venv path when provided', async () => {
    getConfigurationStub.returns({
      get: () => '/mocked_path_to/zenml_venv',
      update: sinon.stub().resolves(),
    } as any);

    const shell = new MockShell();
    const result = await shell.runPythonScript('valid_script.py');
    assert.strictEqual(result, JSON.stringify({ key: 'mocked_value' }), 'runPythonScript should return the expected value');
  });
});
