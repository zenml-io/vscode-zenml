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
    sinon.assert.match(testWebview, sinon.match.instanceOf(WebviewBase));
    sinon.assert.match(testWebview, sinon.match.instanceOf(TestWebviewBase));
  });

  test('getHtmlContent should return HTML string', () => {
    const content = testWebview.getHtmlContent();
    sinon.assert.match(content, sinon.match.string);
    sinon.assert.match(content, sinon.match(/html/));
  });

  test('should handle webview panel creation patterns', () => {
    // Test that the base class can be extended properly
    const htmlContent = testWebview.getHtmlContent();
    sinon.assert.match(htmlContent, sinon.match(/Test Content/));
  });

  test('concrete implementation should provide HTML content', () => {
    // Verify that our test implementation works
    const content = testWebview.getHtmlContent();
    sinon.assert.match(typeof content, 'string');
    sinon.assert.match(content.length > 0, true);
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
    sinon.assert.match(content, sinon.match(/Another Test/));
  });

  test('should maintain proper inheritance chain', () => {
    sinon.assert.match(testWebview instanceof WebviewBase, true);
    sinon.assert.match(testWebview instanceof TestWebviewBase, true);
  });
});
