import { Shell } from '../utils/shell';
import { ServerStatus } from '../views/containers/serverView/ServerTreeItems';

/**
 * Checks the status of the ZenML server by executing a Python script and parsing its output.
 * The python script leverages the ZenML Python client to determine if the server is connected,
 * and retrieves the host and port of the server.
 *
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @returns {Promise<ServerStatus>} - A promise that resolves with an object containing server status information.
 */
export async function checkZenMLServerStatus(shell: Shell): Promise<ServerStatus> {
  try {
    const output = await shell.runPythonScript('check_server_status.py');
    const serverStatusInfo = JSON.parse(output);

    return {
      isConnected: serverStatusInfo.isConnected,
      host: serverStatusInfo.host,
      port: serverStatusInfo.port,
      storeType: serverStatusInfo.store_type,
      storeUrl: serverStatusInfo.store_url
    };

  } catch (error) {
    console.error(`Failed to check ZenML server status: ${error}`);
    return { isConnected: false };
  }
}

/**
 * Connects to a ZenML server using provided credentials.
 * 
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @param {string} serverName - The name of the server to connect to.
 * @param {string} username - The username for authentication.
 * @param {string} password - The password for authentication.
 * @returns {Promise<boolean>} - A promise that resolves to true if the connection was successful.
 */
export async function connectToZenMLServer(shell: Shell, serverName: string, username: string, password: string): Promise<boolean> {
  try {
    const output = await shell.runPythonScript('connect_server.py', [serverName, username, password]);
    console.log(output);
    return output.includes("Connected successfully");
  } catch (error) {
    console.error(`Failed to connect to ZenML server: ${error}`);
    return false;
  }
}

/**
 * Disconnects from the current ZenML server.
 * 
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @returns {Promise<boolean>} - A promise that resolves to true if the disconnection was successful.
 */
export async function disconnectFromZenMLServer(shell: Shell): Promise<boolean> {
  try {
    const output = await shell.runPythonScript('disconnect_server.py');
    console.log(output);
    return output.includes("Disconnected successfully");
  } catch (error) {
    console.error(`Failed to disconnect from ZenML server: ${error}`);
    return false;
  }
}
