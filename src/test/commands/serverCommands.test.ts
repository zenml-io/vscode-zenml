import * as assert from 'assert';
import { checkZenMLServerStatus } from '../../commands/serverCommands';
import { Shell } from '../../utils/shell';

class MockShell extends Shell {
  public async runPythonScript(scriptPath: string, args: string[] = []): Promise<any> {
    const simulatedOutput = JSON.stringify({
      is_connected: true,
      store_url: "http://127.0.0.1:8237",
      store_type: "local server"
    });
    return simulatedOutput;
  }
}

suite('Server Commands Test Suite', () => {
  test('checkZenMLServerStatus correctly fetches server status', async () => {
    const mockShell = new MockShell();

    const serverStatus = await checkZenMLServerStatus(mockShell);

    assert.strictEqual(serverStatus.isConnected, true, 'Server should be reported as connected');
    assert.strictEqual(serverStatus.storeUrl, "http://127.0.0.1:8237", 'Server URL does not match expected value');
    assert.strictEqual(serverStatus.storeType, "local server", 'Server type does not match expected value');
  });
});
