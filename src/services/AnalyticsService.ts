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
// or implied. See the License for the specific language governing
// permissions and limitations under the License.

import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
  ANALYTICS_ANONYMOUS_ID_KEY,
  ANALYTICS_ENDPOINT,
  ANALYTICS_SOURCE_CONTEXT,
  ANALYTICS_TRACK,
  SERVER_STATUS_UPDATED,
} from '../utils/constants';
import { categorizeServerUrl, getZenMLAnalyticsEnabled } from '../utils/global';
import { EventBus } from './EventBus';

/**
 * Properties that can be attached to an analytics event.
 */
export type AnalyticsProperties = Record<string, unknown>;

/**
 * Payload for tracking an analytics event via EventBus.
 */
export interface AnalyticsTrackPayload {
  event: string;
  properties?: AnalyticsProperties;
}

/**
 * Shape of events sent to the ZenML Analytics Server.
 */
interface ZenAnalyticsTrackEvent {
  type: 'track';
  user_id: string;
  event: string;
  properties: AnalyticsProperties;
  debug: boolean;
}

/**
 * AnalyticsService provides best-effort, non-blocking analytics tracking
 * for the ZenML VS Code extension. Events are sent to the ZenML Analytics
 * Server (https://analytics.zenml.io/batch).
 *
 * Key features:
 * - Respects VS Code telemetry settings AND zenml.analyticsEnabled
 * - Anonymous user ID persisted in VS Code globalState
 * - Batched event sending with periodic flush
 * - Never throws - all errors are silently caught
 */
export class AnalyticsService {
  private static instance: AnalyticsService;

  private context?: vscode.ExtensionContext;
  private eventBus?: EventBus;
  private anonymousId?: string;
  private queue: ZenAnalyticsTrackEvent[] = [];
  private flushInterval?: NodeJS.Timeout;
  private isFlushing = false;
  private httpClient: AxiosInstance;
  private lastServerConnected?: boolean;
  private telemetryChangeDisposable?: vscode.Disposable;

  // Configuration
  private readonly MAX_QUEUE_SIZE = 200;
  private readonly MAX_BATCH_SIZE = 20;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds
  private readonly HTTP_TIMEOUT_MS = 3000;
  // Debug mode routes events to dev Segment. Enable via ZENML_ANALYTICS_DEBUG=1
  private readonly DEBUG_MODE = process.env.ZENML_ANALYTICS_DEBUG === '1';
  // Verbose logging for local testing. Enable via ZENML_ANALYTICS_VERBOSE=1
  private readonly VERBOSE_LOGGING = process.env.ZENML_ANALYTICS_VERBOSE === '1';

  private constructor() {
    this.httpClient = axios.create({
      baseURL: ANALYTICS_ENDPOINT,
      timeout: this.HTTP_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Source-Context': ANALYTICS_SOURCE_CONTEXT,
      },
    });
  }

  /**
   * Get the singleton instance of AnalyticsService.
   */
  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Initialize the analytics service with the extension context.
   * Must be called during extension activation.
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;

    // Subscribe to VS Code telemetry changes if available
    if (vscode.env.onDidChangeTelemetryEnabled) {
      this.telemetryChangeDisposable = vscode.env.onDidChangeTelemetryEnabled(() => {
        this.refreshEnablement();
      });
      context.subscriptions.push(this.telemetryChangeDisposable);
    }

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush('interval').catch(() => {});
    }, this.FLUSH_INTERVAL_MS);

    if (this.VERBOSE_LOGGING) {
      console.log('[Analytics] Initialized with settings:');
      console.log(`  - Debug mode: ${this.DEBUG_MODE}`);
      console.log(`  - Verbose logging: ${this.VERBOSE_LOGGING}`);
      console.log(`  - VS Code telemetry enabled: ${this.isVSCodeTelemetryEnabled()}`);
      console.log(`  - ZenML analytics enabled: ${this.isZenMLAnalyticsEnabled()}`);
      console.log(`  - Effectively enabled: ${this.isEnabled()}`);
      console.log(`  - Endpoint: ${ANALYTICS_ENDPOINT}`);
    }
  }

  /**
   * Register the EventBus for event-driven tracking.
   * Subscribes to relevant events.
   */
  public registerEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    // Subscribe to generic analytics track events
    eventBus.on(ANALYTICS_TRACK, (payload: AnalyticsTrackPayload) => {
      this.track(payload.event, payload.properties);
    });

    // Subscribe to server status changes for connection tracking
    // Note: ServerDataProvider emits 'serverUrl', not 'url'
    eventBus.on(SERVER_STATUS_UPDATED, (status: { isConnected: boolean; serverUrl?: string }) => {
      this.handleServerStatusChange(status);
    });
  }

  /**
   * Track an analytics event. This is best-effort and never throws.
   *
   * @param event - The event name (e.g., 'extension.activated', 'stack.rename')
   * @param properties - Optional properties to attach to the event
   */
  public track(event: string, properties?: AnalyticsProperties): void {
    try {
      if (!this.isEnabled()) {
        if (this.VERBOSE_LOGGING) {
          const vscodeTelemetry = this.isVSCodeTelemetryEnabled();
          const zenmlAnalytics = this.isZenMLAnalyticsEnabled();
          console.log(
            `[Analytics] Skipped "${event}" - disabled (vscode telemetry: ${vscodeTelemetry}, zenml setting: ${zenmlAnalytics})`
          );
        }
        return;
      }

      const userId = this.getOrCreateAnonymousId();
      if (!userId) {
        return;
      }

      const trackEvent: ZenAnalyticsTrackEvent = {
        type: 'track',
        user_id: userId,
        event,
        properties: {
          ...properties,
          extensionVersion: this.getExtensionVersion(),
          vscodeVersion: vscode.version,
          platform: process.platform,
          timestamp: new Date().toISOString(),
        },
        debug: this.DEBUG_MODE,
      };

      this.enqueue(trackEvent);

      if (this.VERBOSE_LOGGING) {
        console.log(`[Analytics] Tracked: ${event}`, properties || {});
        console.log(`[Analytics] Queue size: ${this.queue.length}`);
      }

      // Flush if we've reached the batch threshold
      if (this.queue.length >= this.MAX_BATCH_SIZE) {
        this.flush('threshold').catch(() => {});
      }
    } catch {
      // Best effort - never throw
    }
  }

  /**
   * Flush pending events to the analytics server.
   * Best-effort, never throws.
   */
  public async flush(reason?: string): Promise<void> {
    if (this.isFlushing || this.queue.length === 0 || !this.isEnabled()) {
      return;
    }

    this.isFlushing = true;

    try {
      // Take events from queue
      const eventsToSend = this.queue.splice(0, this.MAX_BATCH_SIZE);

      if (eventsToSend.length === 0) {
        return;
      }

      if (this.VERBOSE_LOGGING) {
        console.log(`[Analytics] Sending ${eventsToSend.length} events to ${ANALYTICS_ENDPOINT}`);
        console.log('[Analytics] Payload:', JSON.stringify(eventsToSend, null, 2));
      }

      // POST to analytics server
      await this.httpClient.post('', eventsToSend);

      // Log success
      if (this.VERBOSE_LOGGING) {
        console.log(
          `[Analytics] ✓ Flushed ${eventsToSend.length} events (reason: ${reason || 'manual'})`
        );
      } else {
        console.debug(
          `[Analytics] Flushed ${eventsToSend.length} events (reason: ${reason || 'manual'})`
        );
      }
    } catch (error) {
      // Best effort - silently ignore errors
      if (this.VERBOSE_LOGGING) {
        console.error('[Analytics] ✗ Flush failed:', error);
      } else {
        console.debug('[Analytics] Flush failed:', error);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Clean up resources. Should be called during extension deactivation.
   */
  public async dispose(): Promise<void> {
    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    // Final flush attempt
    await this.flush('dispose');

    // Clear state
    this.queue = [];
    this.eventBus = undefined;
  }

  /**
   * Re-check enablement state. Called when settings change.
   */
  public refreshEnablement(): void {
    if (!this.isEnabled()) {
      // Clear queue if analytics became disabled
      this.queue = [];
    }
  }

  /**
   * Check if analytics are effectively enabled.
   * Requires both VS Code telemetry AND zenml.analyticsEnabled.
   */
  private isEnabled(): boolean {
    return this.isVSCodeTelemetryEnabled() && this.isZenMLAnalyticsEnabled();
  }

  /**
   * Check if VS Code telemetry is enabled.
   */
  private isVSCodeTelemetryEnabled(): boolean {
    // vscode.env.isTelemetryEnabled is the recommended way
    if (typeof vscode.env.isTelemetryEnabled === 'boolean') {
      return vscode.env.isTelemetryEnabled;
    }

    // Fallback: check telemetry.telemetryLevel setting
    const telemetryLevel = vscode.workspace
      .getConfiguration('telemetry')
      .get<string>('telemetryLevel', 'all');

    return telemetryLevel !== 'off';
  }

  /**
   * Check if ZenML analytics setting is enabled.
   */
  private isZenMLAnalyticsEnabled(): boolean {
    return getZenMLAnalyticsEnabled();
  }

  /**
   * Get or create an anonymous user ID.
   * The ID is persisted in VS Code's globalState.
   */
  private getOrCreateAnonymousId(): string | undefined {
    if (this.anonymousId) {
      return this.anonymousId;
    }

    if (!this.context) {
      return undefined;
    }

    // Try to get existing ID
    let id = this.context.globalState.get<string>(ANALYTICS_ANONYMOUS_ID_KEY);

    if (!id) {
      // Generate new UUID
      try {
        id = crypto.randomUUID();
      } catch {
        // Fallback for environments without crypto.randomUUID
        id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      // Persist it (async, but we don't wait)
      this.context.globalState.update(ANALYTICS_ANONYMOUS_ID_KEY, id).then(
        () => {},
        () => {}
      );
    }

    this.anonymousId = id;
    return id;
  }

  /**
   * Get the extension version from package.json.
   */
  private getExtensionVersion(): string {
    try {
      return this.context?.extension?.packageJSON?.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Add an event to the queue, respecting max size.
   */
  private enqueue(event: ZenAnalyticsTrackEvent): void {
    // Drop oldest events if queue is full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.queue.push(event);
  }

  /**
   * Handle server status changes for connection tracking.
   * Only emits events on state transitions to avoid duplicates.
   */
  private handleServerStatusChange(status: { isConnected: boolean; serverUrl?: string }): void {
    const { isConnected, serverUrl } = status;

    // Only track transitions
    if (this.lastServerConnected === isConnected) {
      return;
    }

    this.lastServerConnected = isConnected;

    // Determine connection type without exposing the actual URL
    const connectionType = categorizeServerUrl(serverUrl);

    if (isConnected) {
      this.track('server.connected', { connectionType });
    } else {
      this.track('server.disconnected', { connectionType });
    }
  }
}
