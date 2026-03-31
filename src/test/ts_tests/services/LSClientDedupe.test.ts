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
import { ANALYTICS_TRACK } from '../../../utils/constants';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';

/**
 * Tests for LSClient.emitErrorOccurred dedupe behavior.
 *
 * Strategy: Access the private emitErrorOccurred method via (lsClient as any),
 * spy on eventBus.emit, and verify dedupe logic using fake timers.
 */
suite('LSClient error analytics dedupe', () => {
  let sandbox: sinon.SinonSandbox;
  let lsClient: LSClient;
  let eventBus: EventBus;
  let emitSpy: sinon.SinonSpy;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({ now: 1000000 });

    // Reset singleton
    (LSClient as any).instance = null;
    lsClient = LSClient.getInstance();

    // Replace the eventBus with a fresh one we can spy on
    eventBus = new EventBus();
    (lsClient as any).eventBus = eventBus;
    emitSpy = sandbox.spy(eventBus, 'emit');
  });

  teardown(() => {
    clock.restore();
    sandbox.restore();
    (LSClient as any).instance = null;
  });

  function getAnalyticsEmissions(): sinon.SinonSpyCall[] {
    return emitSpy.getCalls().filter(call => call.args[0] === ANALYTICS_TRACK);
  }

  function callEmitErrorOccurred(
    operation: string,
    phase: 'preflight' | 'request' | 'response',
    err: unknown
  ): void {
    (lsClient as any).emitErrorOccurred(operation, phase, err);
  }

  test('emits error.occurred on first request failure', () => {
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 1);
    assert.strictEqual(emissions[0].args[1].event, 'error.occurred');
    assert.strictEqual(emissions[0].args[1].properties.operation, 'connect');
    assert.strictEqual(emissions[0].args[1].properties.phase, 'request');
  });

  test('deduplicates identical errors within 60s window', () => {
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 1, 'Should only emit once within the dedupe window');
  });

  test('emits again after dedupe window expires', () => {
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));

    // Advance past the 60s dedupe window
    clock.tick(61_000);

    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 2, 'Should emit again after window expires');
  });

  test('different operations are not deduped against each other', () => {
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));
    callEmitErrorOccurred('listStacks', 'request', new Error('ECONNREFUSED'));

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 2, 'Different operations should emit separately');
  });

  test('different phases are not deduped against each other', () => {
    callEmitErrorOccurred('connect', 'request', new Error('some error'));
    callEmitErrorOccurred('connect', 'response', 'some error');

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 2, 'Different phases should emit separately');
  });

  test('preflight errors are hard-deduped to once per session', () => {
    callEmitErrorOccurred('connect', 'preflight', 'LSClient is not ready');
    callEmitErrorOccurred('listStacks', 'preflight', 'LSClient is not ready');

    // Even after the dedupe window, preflight should not re-emit
    clock.tick(120_000);
    callEmitErrorOccurred('connect', 'preflight', 'LSClient is not ready');

    const emissions = getAnalyticsEmissions();
    assert.strictEqual(emissions.length, 1, 'Preflight errors should emit only once per session');
  });

  test('error.occurred properties include errorKind and messageHash', () => {
    callEmitErrorOccurred('connect', 'request', new Error('ECONNREFUSED'));

    const emissions = getAnalyticsEmissions();
    const props = emissions[0].args[1].properties;
    assert.strictEqual(typeof props.errorKind, 'string');
    assert.strictEqual(typeof props.errorSource, 'string');
    assert.strictEqual(typeof props.messageHash, 'string');
    assert.strictEqual(props.messageHash.length, 16, 'messageHash should be 16 hex chars');
  });
});
