import * as assert from 'assert';
import { getActiveStack } from '../../commands/stackCommands';
import { Shell } from '../../utils/shell';
import { parseActiveStackName } from '../../utils/helpers';

class MockShell extends Shell {
  static execCLICommand(): Promise<string> {
    return Promise.resolve("The global active stack is: 'default'");
  }
}

suite('Stack Commands Test Suite', () => {
  test('getActiveStack correctly fetches the active stack name', async () => {
    const cliOutput = await getActiveStack(MockShell.execCLICommand);
    const activeStack = parseActiveStackName(cliOutput);
    assert.strictEqual(activeStack, 'default', 'getActiveStack did not return the expected stack name');
  });
});
