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
import { categorizeServerUrl, ServerConnectionType } from '../../../utils/global';
import {
  ANALYTICS_ENDPOINT,
  ANALYTICS_SOURCE_CONTEXT,
  ANALYTICS_ANONYMOUS_ID_KEY,
  ANALYTICS_TRACK,
} from '../../../utils/constants';
import { AnalyticsService } from '../../../services/AnalyticsService';

/**
 * Tests for the categorizeServerUrl utility function.
 * This is the privacy-safe URL classification used by AnalyticsService.
 */
suite('categorizeServerUrl Utility', () => {
  suite('local URLs', () => {
    test('classifies localhost as local', () => {
      assert.strictEqual(categorizeServerUrl('http://localhost:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('https://localhost:8237/api/v1'), 'local');
      assert.strictEqual(categorizeServerUrl('http://localhost'), 'local');
    });

    test('classifies 127.0.0.1 as local', () => {
      assert.strictEqual(categorizeServerUrl('http://127.0.0.1:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('https://127.0.0.1'), 'local');
    });

    test('classifies 0.0.0.0 as local', () => {
      assert.strictEqual(categorizeServerUrl('http://0.0.0.0:8237'), 'local');
    });

    test('classifies 192.168.x.x (private network) as local', () => {
      assert.strictEqual(categorizeServerUrl('http://192.168.1.1:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('http://192.168.0.100'), 'local');
      assert.strictEqual(categorizeServerUrl('http://192.168.255.255:8080'), 'local');
    });

    test('classifies 10.x.x.x (private network) as local', () => {
      assert.strictEqual(categorizeServerUrl('http://10.0.0.1:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('http://10.255.255.255'), 'local');
    });

    test('classifies .local domains as local', () => {
      assert.strictEqual(categorizeServerUrl('http://my-mac.local:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('http://zenml-server.local'), 'local');
    });
  });

  suite('cloud URLs', () => {
    test('classifies zenml.io domains as cloud', () => {
      assert.strictEqual(categorizeServerUrl('https://api.zenml.io'), 'cloud');
      assert.strictEqual(categorizeServerUrl('https://cloudapi.zenml.io'), 'cloud');
      assert.strictEqual(categorizeServerUrl('https://my-org.zenml.io'), 'cloud');
    });

    test('classifies cloudapi.zenml domains as cloud', () => {
      assert.strictEqual(categorizeServerUrl('https://cloudapi.zenml.io/api/v1'), 'cloud');
    });
  });

  suite('remote URLs', () => {
    test('classifies non-local, non-cloud URLs as remote', () => {
      assert.strictEqual(categorizeServerUrl('https://zenml.mycompany.com'), 'remote');
      assert.strictEqual(categorizeServerUrl('https://ml-platform.internal.company.com'), 'remote');
      assert.strictEqual(categorizeServerUrl('http://8.8.8.8:8237'), 'remote');
    });
  });

  suite('unknown/invalid URLs', () => {
    test('returns unknown for undefined', () => {
      assert.strictEqual(categorizeServerUrl(undefined), 'unknown');
    });

    test('returns unknown for empty string', () => {
      assert.strictEqual(categorizeServerUrl(''), 'unknown');
    });

    test('returns unknown for invalid URLs', () => {
      assert.strictEqual(categorizeServerUrl('not-a-url'), 'unknown');
      assert.strictEqual(categorizeServerUrl('://invalid'), 'unknown');
      assert.strictEqual(categorizeServerUrl('ftp://'), 'unknown');
    });
  });

  suite('case insensitivity', () => {
    test('handles uppercase hostnames', () => {
      assert.strictEqual(categorizeServerUrl('http://LOCALHOST:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('https://API.ZENML.IO'), 'cloud');
    });

    test('handles mixed case hostnames', () => {
      assert.strictEqual(categorizeServerUrl('http://LocalHost:8237'), 'local');
      assert.strictEqual(categorizeServerUrl('https://CloudAPI.ZenML.io'), 'cloud');
    });
  });
});

/**
 * Tests for analytics constants configuration.
 * Verifies the ZenML Analytics Server integration is correctly configured.
 */
suite('Analytics Constants', () => {
  test('endpoint is correctly configured', () => {
    assert.strictEqual(ANALYTICS_ENDPOINT, 'https://analytics.zenml.io/batch');
  });

  test('source context is vscode', () => {
    assert.strictEqual(ANALYTICS_SOURCE_CONTEXT, 'vscode');
  });

  test('anonymous ID key follows zenml namespace', () => {
    assert.strictEqual(ANALYTICS_ANONYMOUS_ID_KEY, 'zenml.analyticsAnonymousId');
  });

  test('track event name is defined', () => {
    assert.strictEqual(ANALYTICS_TRACK, 'analyticsTrack');
  });
});

/**
 * Tests for AnalyticsService singleton behavior.
 * These tests verify the service structure and robustness guarantees.
 */
suite('AnalyticsService', () => {
  suite('singleton pattern', () => {
    test('getInstance returns same instance', () => {
      const instance1 = AnalyticsService.getInstance();
      const instance2 = AnalyticsService.getInstance();
      assert.strictEqual(instance1, instance2);
    });

    test('instance has required public methods', () => {
      const service = AnalyticsService.getInstance();
      assert.strictEqual(typeof service.initialize, 'function');
      assert.strictEqual(typeof service.registerEventBus, 'function');
      assert.strictEqual(typeof service.track, 'function');
      assert.strictEqual(typeof service.flush, 'function');
      assert.strictEqual(typeof service.dispose, 'function');
      assert.strictEqual(typeof service.refreshEnablement, 'function');
    });
  });

  suite('track() robustness', () => {
    test('track() never throws even without initialization', () => {
      const service = AnalyticsService.getInstance();
      // This should not throw - best-effort guarantee
      assert.doesNotThrow(() => {
        service.track('test.event', { test: true });
      });
    });

    test('track() handles undefined properties', () => {
      const service = AnalyticsService.getInstance();
      assert.doesNotThrow(() => {
        service.track('test.event.undefined.props', undefined);
      });
    });

    test('track() handles empty event name', () => {
      const service = AnalyticsService.getInstance();
      assert.doesNotThrow(() => {
        service.track('', { test: true });
      });
    });

    test('track() handles complex properties', () => {
      const service = AnalyticsService.getInstance();
      assert.doesNotThrow(() => {
        service.track('test.complex.props', {
          nested: { deep: { value: 123 } },
          array: [1, 2, 3],
          nullValue: null,
          boolValue: false,
          numValue: 42.5,
        });
      });
    });
  });

  suite('flush() robustness', () => {
    test('flush() never throws even without initialization', async () => {
      const service = AnalyticsService.getInstance();
      // This should not throw - best-effort guarantee
      await assert.doesNotReject(async () => {
        await service.flush('test');
      });
    });

    test('flush() handles multiple concurrent calls', async () => {
      const service = AnalyticsService.getInstance();
      // Multiple concurrent flush calls should not throw
      await assert.doesNotReject(async () => {
        await Promise.all([
          service.flush('concurrent1'),
          service.flush('concurrent2'),
          service.flush('concurrent3'),
        ]);
      });
    });
  });

  suite('dispose() robustness', () => {
    test('dispose() completes without error', async () => {
      const service = AnalyticsService.getInstance();
      await assert.doesNotReject(async () => {
        await service.dispose();
      });
    });
  });

  suite('refreshEnablement() robustness', () => {
    test('refreshEnablement() does not throw', () => {
      const service = AnalyticsService.getInstance();
      assert.doesNotThrow(() => {
        service.refreshEnablement();
      });
    });
  });
});

/**
 * Tests for ServerConnectionType type safety.
 */
suite('ServerConnectionType', () => {
  test('all connection types are valid string literals', () => {
    const types: ServerConnectionType[] = ['local', 'cloud', 'remote', 'unknown'];
    types.forEach(type => {
      assert.strictEqual(typeof type, 'string');
    });
  });

  test('categorizeServerUrl returns valid ServerConnectionType', () => {
    const testCases: Array<[string | undefined, ServerConnectionType]> = [
      ['http://localhost:8237', 'local'],
      ['https://api.zenml.io', 'cloud'],
      ['https://example.com', 'remote'],
      [undefined, 'unknown'],
    ];

    testCases.forEach(([input, expected]) => {
      const result: ServerConnectionType = categorizeServerUrl(input);
      assert.strictEqual(result, expected);
    });
  });
});
