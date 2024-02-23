import { Shell } from "../../utils/Shell";

/**
 * Connects to a ZenML server using provided credentials.
 *
 * @param {Shell} shell - The Shell instance used to execute the Python script.
 * @param {string} serverName - The name of the server to connect to.
 * @param {string} username - The username for authentication.
 * @param {string} password - The password for authentication.
 * @returns {Promise<boolean>} - A promise that resolves to true if the connection was successful.
 */
export async function connectToZenMLServer(
  shell: Shell,
  serverName: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const output = await shell.runPythonScript("connect_server.py", [
      serverName,
      username,
      password,
    ]);
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
    const output = await shell.runPythonScript("disconnect_server.py");
    console.log(output);
    return output.includes("Disconnected successfully");
  } catch (error) {
    console.error(`Failed to disconnect from ZenML server: ${error}`);
    return false;
  }
}
