// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.See the License for the specific language governing
// permissions and limitations under the License.
import { exec } from "child_process";
import * as vscode from "vscode";
import * as path from "path";

export class Shell {
  public venvPath: string | undefined;

  /**
   * Constructs a new Shell instance.
   * Initializes the Shell instance with a virtual environment path (venvPath) from the VSCode workspace configuration.
   * The `venvPath` is retrieved from the `zenml-io.zenml` configuration settings, which can be set by the user in their VSCode settings.
   * If the `venvPath` setting is not configured, `venvPath` will be `undefined`.
   */
  constructor() {
    this.venvPath = vscode.workspace
      .getConfiguration("zenml-io.zenml")
      .get("venvPath") as string | undefined;
  }

  /**
 * Abstracts the execution of shell commands, making it easier to stub this behavior in tests.
 * 
 * @param command The shell command to execute.
 * @returns A promise that resolves with the command's output or rejects with an error.
 */
  protected executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }


  /**
   * Checks if ZenML is installed by attempting to import it in a Python script.
   * 
   * @returns {Promise<boolean>} - A promise that resolves with true if ZenML is installed, false otherwise.
   */
  async checkZenMLInstallation(): Promise<boolean> {
    const command = 'python -c "import zenml"';
    try {
      await this.executeCommand(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prompts the user to enter the path to their virtual environment if ZenML is not detected.
   * Updates the extension's configuration with the provided path.
   * 
   * @returns {Promise<void>} - A promise that resolves when the user has entered the path, or rejects if not provided.
   */
  async promptForVenvPath(): Promise<void> {
    const venvPath = await vscode.window.showInputBox({
      prompt:
        "ZenML is not detected. Enter the path to the virtual environment where ZenML is installed:",
      placeHolder:
        "Path to virtual environment (leave empty if ZenML is installed globally)",
    });

    if (venvPath) {
      await vscode.workspace
        .getConfiguration("zenml")
        .update("venvPath", venvPath, true);
      this.venvPath = venvPath;
    } else {
      throw new Error("ZenML installation path is required.");
    }
  }

  /**
   * Runs a Python script using the configured virtual environment, or the system's default Python installation.
   * 
   * @param {string} scriptFilename - The path to the Python script to be executed.
   * @param {string[]} args - Arguments to pass to the Python script.
   * @returns {Promise<any>} - A promise that resolves with the JSON-parsed output of the script.
   */
  public async runPythonScript(scriptFilename: string, args: string[] = []): Promise<any> {
    if (!(await this.checkZenMLInstallation()) && !this.venvPath) {
      await this.promptForVenvPath();
    }
    const isWindows = process.platform === "win32";
    let pythonCommand = this.venvPath
      ? `${isWindows
        ? `${this.venvPath}\\Scripts\\python`
        : `${this.venvPath}/bin/python`
      }`
      : "python";

    const scriptPath = this.getScriptPath(scriptFilename);

    return new Promise((resolve, reject) => {
      exec(
        // Ensure scriptPath and args are sanitized or validated here
        `${pythonCommand} ${scriptPath} ${args.join(" ")}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
            reject(error);
            return;
          }
          try {
            resolve(stdout);
          } catch (parseError) {
            console.error(`Error parsing Python script output: ${parseError}`);
            reject(parseError);
          }
        }
      );
    });
  }

  /**
   * Resolves the full path to a Python script.
   * 
   * @param {string} scriptName - The name of the script file.
   * @returns {string} - The full path to the script.
   */
  public getScriptPath(scriptName: string): string {
    const extensionPath =
      vscode.extensions.getExtension("zenml-io.zenml")?.extensionPath || "";
    // Ensure scriptName is validated or sanitized here
    return path.join(extensionPath, scriptName);
  }
}