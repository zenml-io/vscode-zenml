import { exec } from 'child_process';

export class Shell {
  /**
   * Executes a CLI command and returns a promise that resolves with the command's stdout.
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
}
