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
import {
  sanitizeErrorForAnalytics,
  normalizeForHash,
  sha256Hex,
  isErrorLikeResponse,
} from '../../../utils/analytics';

/**
 * Tests for the privacy-safe error classification utility.
 */
suite('sanitizeErrorForAnalytics', () => {
  suite('error kind classification', () => {
    test('classifies "not ready" as lsp_not_ready', () => {
      const result = sanitizeErrorForAnalytics('LSClient is not ready yet.', {
        phase: 'preflight',
      });
      assert.strictEqual(result.errorKind, 'lsp_not_ready');
    });

    test('classifies "not initialized" as lsp_not_ready', () => {
      const result = sanitizeErrorForAnalytics('Server not initialized', { phase: 'preflight' });
      assert.strictEqual(result.errorKind, 'lsp_not_ready');
    });

    test('classifies authorization errors', () => {
      const result = sanitizeErrorForAnalytics('Authorization failed for user', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'authorization_error');
    });

    test('classifies 401 as authorization error', () => {
      const result = sanitizeErrorForAnalytics('HTTP 401 Unauthorized', { phase: 'request' });
      assert.strictEqual(result.errorKind, 'authorization_error');
    });

    test('classifies ValidationError', () => {
      const result = sanitizeErrorForAnalytics('ValidationError: name is required', {
        phase: 'response',
        isResponseError: true,
      });
      assert.strictEqual(result.errorKind, 'validation_error');
    });

    test('classifies RuntimeError', () => {
      const result = sanitizeErrorForAnalytics('RuntimeError: something broke', {
        phase: 'response',
        isResponseError: true,
      });
      assert.strictEqual(result.errorKind, 'runtime_error');
    });

    test('classifies timeout errors', () => {
      const result = sanitizeErrorForAnalytics('Request timed out after 30s', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'timeout');
    });

    test('classifies ETIMEDOUT', () => {
      const result = sanitizeErrorForAnalytics('connect ETIMEDOUT 10.0.0.1:443', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'timeout');
    });

    test('classifies ECONNREFUSED as network_error', () => {
      const result = sanitizeErrorForAnalytics(new Error('connect ECONNREFUSED 127.0.0.1:8237'), {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'network_error');
    });

    test('classifies ENOTFOUND as network_error', () => {
      const result = sanitizeErrorForAnalytics('getaddrinfo ENOTFOUND example.com', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'network_error');
    });

    test('classifies SSL errors as network_error', () => {
      const result = sanitizeErrorForAnalytics('SSL certificate problem: unable to verify', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'network_error');
    });

    test('classifies unrecognized response errors as lsp_response_error', () => {
      const result = sanitizeErrorForAnalytics('Something unexpected happened', {
        phase: 'response',
        isResponseError: true,
      });
      assert.strictEqual(result.errorKind, 'lsp_response_error');
    });

    test('classifies unrecognized request errors as lsp_request_failed', () => {
      const result = sanitizeErrorForAnalytics('Something unexpected happened', {
        phase: 'request',
      });
      assert.strictEqual(result.errorKind, 'lsp_request_failed');
    });

    test('classifies preflight errors without keyword match as lsp_not_ready', () => {
      const result = sanitizeErrorForAnalytics('some other preflight issue', {
        phase: 'preflight',
      });
      assert.strictEqual(result.errorKind, 'lsp_not_ready');
    });

    test('classifies errors with no phase as unknown', () => {
      const result = sanitizeErrorForAnalytics('mystery error');
      assert.strictEqual(result.errorKind, 'unknown');
    });
  });

  suite('error source classification', () => {
    test('preflight → extension', () => {
      const result = sanitizeErrorForAnalytics('not ready', { phase: 'preflight' });
      assert.strictEqual(result.errorSource, 'extension');
    });

    test('request → lsp_transport', () => {
      const result = sanitizeErrorForAnalytics('failed', { phase: 'request' });
      assert.strictEqual(result.errorSource, 'lsp_transport');
    });

    test('response → lsp_response', () => {
      const result = sanitizeErrorForAnalytics('error', {
        phase: 'response',
        isResponseError: true,
      });
      assert.strictEqual(result.errorSource, 'lsp_response');
    });

    test('no phase → unknown', () => {
      const result = sanitizeErrorForAnalytics('error');
      assert.strictEqual(result.errorSource, 'unknown');
    });
  });

  suite('error input handling', () => {
    test('handles Error instances', () => {
      const result = sanitizeErrorForAnalytics(new Error('test error'), { phase: 'request' });
      assert.strictEqual(typeof result.messageHash, 'string');
      assert.strictEqual(result.messageHash.length, 16);
    });

    test('handles string errors', () => {
      const result = sanitizeErrorForAnalytics('string error', { phase: 'request' });
      assert.strictEqual(typeof result.messageHash, 'string');
    });

    test('handles object with error property', () => {
      const result = sanitizeErrorForAnalytics({ error: 'object error' }, { phase: 'response' });
      assert.strictEqual(typeof result.messageHash, 'string');
    });

    test('handles object with message property', () => {
      const result = sanitizeErrorForAnalytics({ message: 'msg error' }, { phase: 'response' });
      assert.strictEqual(typeof result.messageHash, 'string');
    });

    test('handles null/undefined gracefully', () => {
      assert.doesNotThrow(() => sanitizeErrorForAnalytics(null, { phase: 'request' }));
      assert.doesNotThrow(() => sanitizeErrorForAnalytics(undefined, { phase: 'request' }));
    });
  });

  suite('message hash privacy', () => {
    test('hash is 16 characters (truncated SHA-256 hex)', () => {
      const result = sanitizeErrorForAnalytics('some error', { phase: 'request' });
      assert.strictEqual(result.messageHash.length, 16);
      assert.match(result.messageHash, /^[0-9a-f]{16}$/);
    });

    test('same normalized message produces same hash', () => {
      const result1 = sanitizeErrorForAnalytics('connection failed', { phase: 'request' });
      const result2 = sanitizeErrorForAnalytics('connection failed', { phase: 'request' });
      assert.strictEqual(result1.messageHash, result2.messageHash);
    });

    test('messages differing only by URL produce same hash', () => {
      const result1 = sanitizeErrorForAnalytics('Failed to connect to https://server1.com:8237', {
        phase: 'request',
      });
      const result2 = sanitizeErrorForAnalytics('Failed to connect to https://server2.com:443', {
        phase: 'request',
      });
      assert.strictEqual(result1.messageHash, result2.messageHash);
    });

    test('messages differing only by UUID produce same hash', () => {
      const result1 = sanitizeErrorForAnalytics(
        'Stack a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
        { phase: 'response', isResponseError: true }
      );
      const result2 = sanitizeErrorForAnalytics(
        'Stack 12345678-abcd-ef12-3456-789012345678 not found',
        { phase: 'response', isResponseError: true }
      );
      assert.strictEqual(result1.messageHash, result2.messageHash);
    });

    test('messages differing only by file path produce same hash', () => {
      const result1 = sanitizeErrorForAnalytics('Error reading /home/user/config.yaml', {
        phase: 'request',
      });
      const result2 = sanitizeErrorForAnalytics('Error reading /opt/zenml/config.yaml', {
        phase: 'request',
      });
      assert.strictEqual(result1.messageHash, result2.messageHash);
    });
  });
});

suite('normalizeForHash', () => {
  test('replaces URLs', () => {
    const result = normalizeForHash('Failed at https://example.com/path');
    assert.ok(result.includes('<url>'));
    assert.ok(!result.includes('example.com'));
  });

  test('replaces file paths', () => {
    const result = normalizeForHash('Error in /usr/local/bin/python');
    assert.ok(result.includes('<path>'));
    assert.ok(!result.includes('/usr/local'));
  });

  test('replaces UUIDs', () => {
    const result = normalizeForHash('Stack a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found');
    assert.ok(result.includes('<uuid>'));
    assert.ok(!result.includes('a1b2c3d4'));
  });

  test('replaces hex tokens', () => {
    const result = normalizeForHash('Token abcdef1234567890abcdef1234567890 is invalid');
    assert.ok(result.includes('<token>'));
  });

  test('lowercases output', () => {
    const result = normalizeForHash('UPPERCASE ERROR');
    assert.strictEqual(result, 'uppercase error');
  });

  test('trims whitespace', () => {
    const result = normalizeForHash('  error  ');
    assert.strictEqual(result, 'error');
  });
});

suite('sha256Hex', () => {
  test('returns 16-char hex string', () => {
    const result = sha256Hex('test input');
    assert.strictEqual(result.length, 16);
    assert.match(result, /^[0-9a-f]{16}$/);
  });

  test('is deterministic', () => {
    assert.strictEqual(sha256Hex('same input'), sha256Hex('same input'));
  });

  test('different inputs produce different hashes', () => {
    assert.notStrictEqual(sha256Hex('input a'), sha256Hex('input b'));
  });
});

suite('isErrorLikeResponse', () => {
  test('returns true for objects with error property', () => {
    assert.strictEqual(isErrorLikeResponse({ error: 'something' }), true);
  });

  test('returns false for null', () => {
    assert.strictEqual(isErrorLikeResponse(null), false);
  });

  test('returns false for undefined', () => {
    assert.strictEqual(isErrorLikeResponse(undefined), false);
  });

  test('returns false for strings', () => {
    assert.strictEqual(isErrorLikeResponse('error'), false);
  });

  test('returns false for objects without error property', () => {
    assert.strictEqual(isErrorLikeResponse({ message: 'ok' }), false);
  });
});
