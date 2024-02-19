import { execCLICommand } from '../utils/shell';

/**
 * Fetches the current active stack using the ZenML CLI.
 */
export function getActiveStack(): Promise<string> {
  return execCLICommand('zenml stack get');
}
