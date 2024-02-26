import { Shell } from "../utils/Shell";
import { ServerStatus } from "../types/ServerTypes";

export class ServerStatusService {
  private static instance: ServerStatusService;
  private shell: Shell;
  private currentStatus: ServerStatus = { isConnected: false };
  private listeners: ((status: ServerStatus) => void)[] = [];

  /**
   * Creates an instance of the ServerStatusService class.
   * This constructor is private to enforce the singleton pattern, ensuring that only one instance of the ServerStatusService exists within the application.
   * It initializes the service, sets up the shell environment for command execution, and starts polling the ZenML server status.
   * 
   * @param {Shell} shell An instance of Shell that provides access to the shell environment to run the script that checks the ZenML server status..
   */
  private constructor(shell: Shell) {
    this.shell = shell;
    this.pollServerStatus();
  }

  /**
   * Retrieves the singleton instance of the ServerStatusService class.
   * If the instance does not exist, it creates one using the provided Shell instance. 
   * This ensures that the same instance is used throughout the application to maintain a consistent state.
   * 
   * @param {Shell} shell An instance of Shell required to create the ServerStatusService if it does not already exist.
   * @returns {ServerStatusService} The singleton instance of the ServerStatusService.
   */
  public static getInstance(shell: Shell): ServerStatusService {
    if (!ServerStatusService.instance) {
      ServerStatusService.instance = new ServerStatusService(shell);
    }
    return ServerStatusService.instance;
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
   * Asynchronously checks the ZenML server status by executing a Python script through the shell.
   * This method attempts to gather detailed information about the ZenML server's status, including its connectivity, host, port, store type, and store URL.
   * In case of an error, it logs the error and returns a status indicating the server is not connected.
   * 
   * @returns {Promise<ServerStatus>} A promise that resolves to the status of the ZenML server, based on the output of the Python script.
   */
  private async checkZenMLServerStatus(): Promise<ServerStatus> {
    try {
      const output = await this.shell.runPythonScript("check_server_status.py");
      try {
        const serverStatusInfo = JSON.parse(output);
        return {
          isConnected: serverStatusInfo.is_connected,
          host: serverStatusInfo.host,
          port: serverStatusInfo.port,
          storeType: serverStatusInfo.store_type,
          storeUrl: serverStatusInfo.store_url,
        };
      } catch (jsonError) {
        console.error(`Failed to parse JSON from ZenML server status check: ${jsonError}`);
        return { isConnected: false };
      }
    } catch (error) {
      console.error(`Failed to check ZenML server status: ${error}`);
      return { isConnected: false };
    }
  }

  /**
   * Continuously polls the ZenML server status at regular intervals (every 30 seconds) to check for any changes.
   * If a change in the server status is detected, it updates the internal status and notifies all subscribed listeners about the change.
   * This method uses a recursive timeout to ensure continuous polling without stacking calls.
   */
  private async pollServerStatus() {
    try {
      const status = await this.checkZenMLServerStatus();
      if (
        this.currentStatus.isConnected !== status.isConnected ||
        this.currentStatus.host !== status.host ||
        this.currentStatus.port !== status.port ||
        this.currentStatus.storeType !== status.storeType ||
        this.currentStatus.storeUrl !== status.storeUrl
      ) {
        this.currentStatus = status;
        this.notifyListeners();
      }
    } catch (error) {
      console.error("Error checking ZenML server status:", error);
    }
    setTimeout(() => this.pollServerStatus(), 30000);
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
