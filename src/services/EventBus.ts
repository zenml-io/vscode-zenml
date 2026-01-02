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
import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Retrieves the singleton instance of EventBus.
   *
   * @returns {EventBus} The singleton instance.
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
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
}
