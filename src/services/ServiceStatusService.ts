// src/services/ServerStatusService.ts
import { checkZenMLServerStatus } from '../commands/serverCommands';
import * as vscode from 'vscode';
import { Shell } from '../utils/shell';

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

  private async pollServerStatus() {
    try {
      const status = await checkZenMLServerStatus(this.shell);
      if (this.currentStatus.isConnected !== status.isConnected ||
        this.currentStatus.host !== status.host ||
        this.currentStatus.port !== status.port ||
        this.currentStatus.storeType !== status.storeType ||
        this.currentStatus.storeUrl !== status.storeUrl) {
        this.currentStatus = status;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error checking ZenML server status:', error);
    }
    setTimeout(() => this.pollServerStatus(), 30000);
  }

  public subscribe(listener: (status: ServerStatus) => void): void {
    this.listeners.push(listener);
    listener(this.currentStatus);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentStatus));
  }
}
