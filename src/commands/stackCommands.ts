import { Shell } from '../utils/shell';

/**
 * Fetches the current active stack using the ZenML CLI.
 * 
 * @param {Function} execCLICommand - Optional. Custom function to execute CLI commands, intended
 *                                    for testing with mocks or stubs.
 * @returns {Promise<string>} Promise resolving with the name of the current active stack.
 */
export async function getActiveStack(execCLICommand: Function = Shell.execCLICommand): Promise<string> {
  return execCLICommand('zenml stack get');
}
