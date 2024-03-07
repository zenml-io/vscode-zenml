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
import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class ZenMLClient {
  public apiClient: AxiosInstance;
  private static instance: ZenMLClient | null = null;

  /**
   * Creates an Axios HTTP client configured with a base URL and an access token.
   * The token is retrieved from the extension's global state and included in all request headers.
   */
  constructor() {
    this.apiClient = axios.create();
  }

  // implement a getInstance method to ensure that only one instance of the client is created
  public static getInstance(): ZenMLClient {
    if (!this.instance) {
      this.instance = new ZenMLClient();
    }
    return this.instance;
  }

  /**
   * Resets the ZenMLClient instance.
   * This method sets the instance to undefined, forcing a reinitialization on the next getInstance() call.
   */
  public static resetInstance() {
    this.instance = null;
  }

  /**
   * Retrieves the ZenML Server URL from the VSCode workspace configuration.
   */
  public getZenMLServerUrl(): string {
    const config = vscode.workspace.getConfiguration('zenml');
    return config.get<string>('serverUrl') || '';
  }

  /**
   * Retrieves the ZenML access token from the VSCode workspace configuration.
   */
  public getZenMLAccessToken(): string {
    const config = vscode.workspace.getConfiguration('zenml');
    return config.get<string>('accessToken') || '';
  }

  /**
   * Makes a request to the ZenML API with optional configurations.
   *
   * @param {string} method - The HTTP method to use for the request.
   * @param {string} endpoint - The API endpoint to target.
   * @param {any} data - The data to send with the request.
   * @param {AxiosRequestConfig} options - Optional configurations for the request.
   * @returns The response data from the request.
   */
  public async request(method: string, endpoint: string, data?: any, options?: AxiosRequestConfig) {
    const serverUrl = this.getZenMLServerUrl();
    if (!serverUrl) {
      console.error('Server URL is not configured.');
      throw new Error('Server URL is not configured.');
    }

    const accessToken = this.getZenMLAccessToken();
    const fullUrl = `${serverUrl}/api/v1${endpoint}`;
    const headers = {
      ...options?.headers,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    };

    try {
      const response = await this.apiClient({
        ...options,
        method,
        url: fullUrl,
        data,
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error(`API Request failed: ${error.response?.statusText || error.message}`);
      throw error;
    }
  }
}
