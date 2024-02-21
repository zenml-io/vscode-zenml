import { Shell } from '../utils/shell';
import * as path from 'path';

/**
 * Checks the status of the ZenML server by executing a Python script and parsing its output.
 * The python script leverages the ZenML Python client to determine if the server is connected,
 * and retrieves the host and port of the server.
 *
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @returns {Promise<{isConnected: boolean, host?: string, port?: number}>} - A promise that resolves with an object containing server status information.
 */
export async function checkZenMLServerStatus(shell: Shell): Promise<{ isConnected: boolean, host?: string, port?: number }> {
  // const scriptPath = path.join(__dirname, '..', 'python', 'check_server_status.py');

  try {
    const output = await shell.runPythonScript('check_server_status.py');
    const serverStatusInfo = JSON.parse(output);

    return {
      isConnected: serverStatusInfo.is_connected,
      host: serverStatusInfo.host,
      port: serverStatusInfo.port
    };

  } catch (error) {
    console.error(`Failed to check ZenML server status: ${error}`);
    return { isConnected: false };
  }
}
