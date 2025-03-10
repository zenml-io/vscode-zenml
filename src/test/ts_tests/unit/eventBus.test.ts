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
import * as assert from 'assert';
import * as sinon from 'sinon';
import { LSCLIENT_READY } from '../../../utils/constants';
import { MockEventBus } from '../__mocks__/MockEventBus';

suite('MockEventBus and Event Handling', () => {
  let eventBus: MockEventBus;
  let spy: sinon.SinonSpy;

  setup(() => {
    eventBus = new MockEventBus();
    spy = sinon.spy();
  });

  test('handles lsClientReady event correctly with mock', () => {
    eventBus.on(LSCLIENT_READY, spy);
    eventBus.emit(LSCLIENT_READY, true);
    assert.ok(
      spy.calledWith(true),
      'lsClientReady event handler was not called with expected argument'
    );
  });

  test('can clear all event handlers and not trigger events', () => {
    eventBus.on(LSCLIENT_READY, spy);
    eventBus.clearAllHandlers();

    // Try emitting the event after clearing all handlers
    eventBus.emit(LSCLIENT_READY, true);

    // Verify the spy was not called since all handlers were cleared
    assert.strictEqual(
      spy.called,
      false,
      'lsClientReady event handler was called despite clearing all handlers'
    );
  });
});
