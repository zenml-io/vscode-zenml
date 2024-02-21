import { Shell } from '../utils/shell';
import * as path from 'path';

/**
 * Checks the status of the ZenML server by executing a Python script and parsing its output.
 * The python script uses the ZenML Python client, and identifies if the server is connected 
 * and differentiates between local and remote servers, as well as local databases.
 * 
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @returns {Promise<{isConnected: boolean, storeUrl?: string, storeType?: string}>} - A promise that resolves with an object containing server status information.
 */
export async function checkZenMLServerStatus(shell: Shell): Promise<{ isConnected: boolean, storeUrl?: string, storeType?: string }> {
  const scriptPath = path.join(__dirname, '..', 'python', 'check_server_status.py');

  try {
    const output = await shell.runPythonScript(scriptPath);
    const serverStatusInfo = JSON.parse(output);

    return {
      isConnected: serverStatusInfo.is_connected,
      storeUrl: serverStatusInfo.store_url,
      storeType: serverStatusInfo.store_type
    };

  } catch (error) {
    console.error(`Failed to check ZenML server status: ${error}`);
    return { isConnected: false };
  }
}
