import * as assert from 'assert';
import { checkZenMLServerStatus } from '../../commands/serverCommands';
import { Shell } from '../../utils/shell';

class MockShell extends Shell {
  public async runPythonScript(scriptPath: string, args: string[] = []): Promise<any> {
    const simulatedOutput = JSON.stringify({
      isConnected: true,
      host: "http://127.0.0.1",
      port: 8237
    });
    return simulatedOutput;
  }
}

suite('Server Commands Test Suite', () => {
  test('checkZenMLServerStatus correctly fetches server status', async () => {
    const mockShell = new MockShell();

    const serverStatus = await checkZenMLServerStatus(mockShell);

    assert.strictEqual(serverStatus.isConnected, true, 'Server should be reported as connected');
    assert.strictEqual(serverStatus.host, "http://127.0.0.1", 'Server host does not match expected value');
    assert.strictEqual(serverStatus.port, 8237, 'Server port does not match expected value');
  });
});
