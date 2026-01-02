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
import { EventEmitter } from 'stream';

export class MockEventBus extends EventEmitter {
  public lsClientReady: boolean = false;
  private static instance: MockEventBus;
  public zenmlReady: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(20);

    this.on('lsClientReady', (isReady: boolean) => {
      this.lsClientReady = isReady;
    });
  }

  /**
   * Retrieves the singleton instance of EventBus.
   *
   * @returns {MockEventBus} The singleton instance.
   */
  public static getInstance(): MockEventBus {
    if (!MockEventBus.instance) {
      MockEventBus.instance = new MockEventBus();
    }
    return MockEventBus.instance;
  }

  /**
   * Clears all event handlers.
   */
  public clearAllHandlers() {
    this.removeAllListeners();
  }

  /**
   * Cleans up event listeners for a specific event and handler.
   * This is important to prevent memory leaks and MaxListenersExceededWarnings.
   *
   * @param {string} event - The event name to clean up
   * @param {Function} [handler] - Optional specific handler to remove
   */
  public cleanupEventListener(event: string, handler?: (...args: any[]) => void): void {
    if (handler) {
      this.off(event, handler);
    } else {
      this.removeAllListeners(event);
    }
  }

  /**
   * Simulates setting the LS Client readiness state.
   *
   * @param isReady A boolean indicating whether the LS Client is ready.
   * @returns void
   */
  public setLsClientReady(isReady: boolean): void {
    this.lsClientReady = isReady;
    this.emit('lsClientReady', isReady);
  }

  /**
   * Gets event handlers for testing purposes.
   *
   * @returns {Map<string, boolean>} A map of event names and whether they have handlers.
   */
  public getEventHandlers(): Map<string, boolean> {
    const handlers = new Map<string, boolean>();
    const eventNames = this.eventNames();
    for (const eventName of eventNames) {
      handlers.set(eventName.toString(), this.listenerCount(eventName) > 0);
    }
    return handlers;
  }
}
