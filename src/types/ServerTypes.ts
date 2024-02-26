/**
 * Interface representing the status of a server, including connectivity and optional details,
 * such as host and port if connected, or storeType and storeUrl if disconnected.
 */
export interface ServerStatus {
  isConnected: boolean;
  host?: string;
  port?: number;
  storeType?: string;
  storeUrl?: string;
}
