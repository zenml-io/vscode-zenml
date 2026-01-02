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
import WebviewBase from '../../../common/WebviewBase';

// Create a concrete test class since WebviewBase is abstract
class TestWebviewBase extends WebviewBase {
  constructor() {
    super();
  }

  public getHtmlContent(): string {
    return '<html><body>Test Content</body></html>';
  }
}

suite('WebviewBase Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let testWebview: TestWebviewBase;

  setup(() => {
    sandbox = sinon.createSandbox();
    testWebview = new TestWebviewBase();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should create WebviewBase instance', () => {
    assert.ok(testWebview instanceof WebviewBase);
    assert.ok(testWebview instanceof TestWebviewBase);
  });

  test('getHtmlContent should return HTML string', () => {
    const content = testWebview.getHtmlContent();
    assert.strictEqual(typeof content, 'string');
    assert.match(content, /html/);
    assert.match(content, /Test Content/);
  });

  test('concrete implementation should provide HTML content', () => {
    // Verify that our test implementation works
    const content = testWebview.getHtmlContent();
    assert.strictEqual(typeof content, 'string');
    assert.ok(content.length > 0);
  });

  test('should be extendable for different webview types', () => {
    // Create another test class to verify extensibility
    class AnotherTestWebview extends WebviewBase {
      getHtmlContent(): string {
        return '<html><body>Another Test</body></html>';
      }
    }

    const anotherWebview = new AnotherTestWebview();
    const content = anotherWebview.getHtmlContent();
    assert.match(content, /Another Test/);
  });

  test('should maintain proper inheritance chain', () => {
    assert.ok(testWebview instanceof WebviewBase);
    assert.ok(testWebview instanceof TestWebviewBase);
  });
});
