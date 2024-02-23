import * as assert from "assert";
import { getActiveStack } from "../../commands/stack/utils";
import { Shell } from "../../utils/Shell";

class MockShell extends Shell {
  public async runPythonScript(
    scriptPath: string,
    args: string[] = []
  ): Promise<any> {
    if (scriptPath.includes("get_active_stack.py")) {
      return JSON.stringify({
        name: "default",
      });
    }
    throw new Error("Unexpected script path");
  }
}

suite("Stack Commands Test Suite", () => {
  test("getActiveStack correctly fetches the active stack name", async () => {
    const mockShell = new MockShell();
    const activeStackName = await getActiveStack(mockShell);
    assert.strictEqual(
      activeStackName,
      "default",
      "getActiveStack did not return the expected stack name"
    );
  });
});
