import { Shell } from "../../utils/Shell";

/**
 * Fetches the current active stack using the ZenML Python client.
 * 
 * @param {Shell} shell - The shell instance to use for running the Python script.
 * @returns {Promise<string>} Promise resolving with the name of the current active stack.
 */
export async function getActiveStack(shell: Shell): Promise<string> {
  try {
    const output = await shell.runPythonScript("get_active_stack.py");
    const stackInfo = JSON.parse(output);
    return stackInfo.name;
  } catch (error) {
    console.error("Failed to fetch active ZenML stack:", error);
    throw new Error("Failed to fetch active ZenML stack");
  }
}
