import { exec } from "child_process";
import * as vscode from "vscode";
import * as path from "path";

export class Shell {
  private venvPath: string | undefined;

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
   * Executes a CLI command and returns a promise that resolves with the command's stdout.
   * 
   * @param {string} command - The command to be executed.
   * @returns {Promise<string>} - A promise that resolves with the output of the command.
   */
  static execCLICommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
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
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
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
        .getConfiguration("zenml-io.zenml")
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
   * Resolves the full path to a Python script located in the extension's 'python' directory.
   * 
   * @param {string} scriptName - The name of the script file.
   * @returns {string} - The full path to the script.
   */
  public getScriptPath(scriptName: string): string {
    const extensionPath =
      vscode.extensions.getExtension("zenml-io.zenml")?.extensionPath || "";
    return path.join(extensionPath, "python", scriptName);
  }
}
