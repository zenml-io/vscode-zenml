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
import { ServerStatus } from "../types/ServerTypes";
import { ZenMLClient } from './ZenMLClient';

export const INITIAL_ZENML_SERVER_STATUS: ServerStatus = {
  isConnected: false,
  url: '',
  id: '',
  version: '',
  debug: false,
  deployment_type: '',
  database_type: '',
  secrets_store_type: '',
  auth_scheme: '',
};

export class ServerStatusService {
  private isActive = true;
  private apiClient: ZenMLClient = ZenMLClient.getInstance();
  private static instance: ServerStatusService;
  private currentStatus = { ...INITIAL_ZENML_SERVER_STATUS };
  private listeners: ((status: ServerStatus) => void)[] = [];

  /**
 * Private constructor to enforce singleton pattern. Initializes the service by starting to poll the server status from the Flask service.
 */
  private constructor() {
    this.isActive = true;
    this.pollServerStatus();
  }

  /**
   * Retrieves or creates the singleton instance of the ServerStatusService, ensuring consistent state throughout the application.
   *
   * @returns {ServerStatusService} The singleton ServerStatusService instance.
   */
  public static getInstance(): ServerStatusService {
    if (!ServerStatusService.instance) {
      ServerStatusService.instance = new ServerStatusService();
    }
    return ServerStatusService.instance;
  }

  /**
 * Reactivates the tree view data by setting isActive to true.
 */
  public resetStatus() {
    this.isActive = false;
    this.currentStatus = { ...INITIAL_ZENML_SERVER_STATUS };
    this.notifyListeners();
  }

  /**
   * Reactivates the tree view data by setting isActive to true.
   */
  public reactivate(): void {
    this.isActive = true;
  }

  /**
   * Gets the current status of the ZenML server.
   * 
   * @returns {ServerStatus} The current status of the ZenML server, including connectivity, host, port, store type, and store URL.
   */
  public getCurrentStatus(): ServerStatus {
    return this.currentStatus;
  }

  /**
   * Asynchronously updates and returns the current status of the ZenML server.
   * This method forces a refresh of the server status by polling the ZenML server, updating the internal status, and then returning the updated status.
   * 
   * @returns {Promise<ServerStatus>} A promise that resolves to the updated current status of the ZenML server.
   */
  public async updateStatus(): Promise<ServerStatus> {
    await this.pollServerStatus();
    return this.currentStatus;
  }

  /**
   * Asynchronously polls the Flask service for the current ZenML server status, updating connectivity and server details.
   * In case of an error, it defaults to a disconnected status.
   *
   * @returns {Promise<ServerStatus>} A promise that resolves to the status of the ZenML server, based on the output of the Python script.
   */
  private async checkZenMLServerStatus(): Promise<ServerStatus> {
    try {
      const serverStatusInfo = await this.apiClient.request('get', '/info');
      const isConnected = serverStatusInfo.deployment_type === 'cloud';

      return {
        isConnected,
        url: this.apiClient.getZenMLServerUrl(),
        id: serverStatusInfo.id,
        version: serverStatusInfo.version,
        debug: serverStatusInfo.debug,
        deployment_type: serverStatusInfo.deployment_type,
        database_type: serverStatusInfo.database_type,
        secrets_store_type: serverStatusInfo.secrets_store_type,
        auth_scheme: serverStatusInfo.auth_scheme,
      };
    } catch (error) {
      console.error(`Failed to check ZenML server status: ${error}`);
      return { ...INITIAL_ZENML_SERVER_STATUS };
    }
  }

  /**
   * Continuously polls the ZenML server status at regular intervals (every 30 seconds) to check for any changes.
   * If a change in the server status is detected, it updates the internal status and notifies all subscribed listeners about the change.
   * This method uses a recursive timeout to ensure continuous polling without stacking calls.
   */
  private async pollServerStatus() {
    if (!this.isActive) {
      return;
    }

    try {
      const status = await this.checkZenMLServerStatus();
      if (
        this.currentStatus.isConnected !== status.isConnected ||
        this.currentStatus.url !== status.url ||
        this.currentStatus.id !== status.id ||
        this.currentStatus.version !== status.version ||
        this.currentStatus.debug !== status.debug ||
        this.currentStatus.deployment_type !== status.deployment_type ||
        this.currentStatus.database_type !== status.database_type ||
        this.currentStatus.secrets_store_type !== status.secrets_store_type ||
        this.currentStatus.auth_scheme !== status.auth_scheme
      ) {
        this.currentStatus = status;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error checking ZenML server status:', error);
    }
  }

  /**
   * Subscribes a new listener for server status updates.
   * Each listener is a function that is called with the current server status as its argument whenever the server status is updated.
   * Immediately invokes the newly added listener with the current status upon subscription.
   * 
   * @param {Function} listener A function that will be called with the ServerStatus object whenever the server status is updated.
   */
  public subscribe(listener: (status: ServerStatus) => void) {
    this.listeners.push(listener);
    listener(this.currentStatus);
  }

  /**
   * Notifies all subscribed listeners of the current server status.
   * This method is called whenever the server status changes, ensuring that all listeners are informed of the most recent status.
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentStatus));
  }
}
