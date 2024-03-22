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
import { ZenServerDetails } from '../types/ServerInfoTypes';
import { PipelineDataProvider, ServerDataProvider, StackDataProvider } from '../views/activityBar';

// Type definition for a refresh function that takes a global configuration object
type RefreshFunction = (updatedServerConfig?: ZenServerDetails) => Promise<void>;

/**
 * Debounces a function to prevent it from being called too frequently.
 *
 * @param func The function to debounce
 * @param wait The time to wait before calling the function
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => Promise<void>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<void> {
  let timeout: NodeJS.Timeout | null = null;

  return async (...args: Parameters<T>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const later = () => {
        timeout = null;
        func(...args)
          .then(resolve)
          .catch(reject);
      };
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(later, wait);
    });
  };
}

/**
 * Creates a debounced and delayed refresh function.
 *
 * @param refreshFn The refresh function to debounce and delay.
 * @param delayMs The delay in milliseconds before executing the refresh.
 * @returns A function that, when called, starts the debounced and delayed execution process.
 */
export function delayRefresh(
  refreshFn: RefreshFunction,
  delayMs: number = 5000
): (updatedServerConfig?: ZenServerDetails) => void {
  const debouncedRefreshFn = debounce(refreshFn, delayMs);
  return (updatedServerConfig?: ZenServerDetails) => {
    debouncedRefreshFn(updatedServerConfig);
  };
}

/**
 * Immediately invokes <refreshFn> and retries it after <delayMs>, for a specified number of <attempts>,
 * applying debounce to prevent rapid successive calls.
 *
 * @param refreshFn The refresh function to attempt.
 * @param delayMs The time in milliseconds to delay before each attempt. Default is 5s.
 * @param attempts The number of attempts to make before giving up.
 * @returns A function that, when called, initiates the delayed attempts to refresh.
 */

export function delayRefreshWithRetry(
  refreshFn: RefreshFunction,
  delayMs: number = 5000,
  attempts: number = 2
): (updatedServerConfig?: ZenServerDetails) => void {
  let refreshCount = 0;

  const executeRefresh = async (updatedServerConfig?: ZenServerDetails) => {
    refreshCount++;
    // refresh is called immediately
    await refreshFn(updatedServerConfig);
    if (refreshCount < attempts) {
      setTimeout(() => executeRefresh(updatedServerConfig), delayMs);
    }
  };

  const debouncedExecuteRefresh = debounce(executeRefresh, delayMs);

  return (updatedServerConfig?: ZenServerDetails) => {
    debouncedExecuteRefresh(updatedServerConfig);
  };
}

/**
 * Triggers a refresh of the UI components.
 *
 * @returns {Promise<void>} A promise that resolves to void.
 */
export async function refreshUIComponents(): Promise<void> {
  await ServerDataProvider.getInstance().refresh();
  await StackDataProvider.getInstance().refresh();
  await PipelineDataProvider.getInstance().refresh();
  // setTimeout(() => {
  //   EventBus.getInstance().emit('refreshServerStatus');
  // }, 2000);
}

export const refreshUtils = {
  debounce,
  delayRefresh,
  delayRefreshWithRetry,
  refreshUIComponents,
};
