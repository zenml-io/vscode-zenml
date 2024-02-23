// src/services/ServerStatusService.ts
import { Shell } from "../utils/Shell";

interface ServerStatus {
  isConnected: boolean;
  host?: string;
  port?: number;
  storeType?: string;
  storeUrl?: string;
}

export class ServerStatusService {
  private static instance: ServerStatusService;
  private shell: Shell;
  private currentStatus: ServerStatus = { isConnected: false };
  private listeners: ((status: ServerStatus) => void)[] = [];

  private constructor(shell: Shell) {
    this.shell = shell;
    this.pollServerStatus();
  }

  public static getInstance(shell: Shell): ServerStatusService {
    if (!ServerStatusService.instance) {
      ServerStatusService.instance = new ServerStatusService(shell);
    }
    return ServerStatusService.instance;
  }

  public getCurrentStatus(): ServerStatus {
    return this.currentStatus;
  }

  private async checkZenMLServerStatus(): Promise<ServerStatus> {
    try {
      const output = await this.shell.runPythonScript("check_server_status.py");
      const serverStatusInfo = JSON.parse(output);
      return {
        isConnected: serverStatusInfo.is_connected,
        host: serverStatusInfo.host,
        port: serverStatusInfo.port,
        storeType: serverStatusInfo.store_type,
        storeUrl: serverStatusInfo.store_url,
      };
    } catch (error) {
      console.error(`Failed to check ZenML server status: ${error}`);
      return { isConnected: false };
    }
  }

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

  public subscribe(listener: (status: ServerStatus) => void): void {
    this.listeners.push(listener);
    listener(this.currentStatus);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentStatus));
  }


}
