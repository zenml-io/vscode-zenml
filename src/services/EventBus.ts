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
import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  public lsClientReady: boolean = false;
  public zenmlClientAvailable: boolean = false;

  constructor() {
    super();
    this.subscribeToEvents();
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
   * Subscribes to relevant events to trigger a refresh of the status bar and tree views.
   *
   * @returns void
   */
  private subscribeToEvents(): void {
    this.on('lsClientReady', this.handleLsClientReady.bind(this));
    this.on('zenmlClientAvailable', this.handleZenmlClientAvailable.bind(this));
  }

  /**
   * Handles the LS Client ready event.
   *
   * @param isReady A boolean indicating whether the LS Client is ready.
   * @returns void
   */
  public handleLsClientReady(isReady: boolean): void {
    this.lsClientReady = isReady;
  }

  /**
   * Handles the ZenML client available event.
   *
   * @param isAvailable A boolean indicating whether the ZenML client is available.
   * @returns void
   */
  public handleZenmlClientAvailable(isAvailable: boolean): void {
    this.zenmlClientAvailable = isAvailable;
  }
}
