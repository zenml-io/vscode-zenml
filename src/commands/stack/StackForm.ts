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

import { handlebars } from 'hbs';
import * as vscode from 'vscode';
import { getAllFlavors, getAllStackComponents } from '../../common/api';
import { traceError, traceInfo } from '../../common/log/logging';
import Panels from '../../common/panels';
import WebviewBase from '../../common/WebviewBase';
import { LSClient } from '../../services/LSClient';
import { Flavor, StackComponent } from '../../types/StackTypes';
import { StackDataProvider } from '../../views/activityBar';

type MixedComponent = { name: string; id: string; url: string };

const ROOT_PATH = ['resources', 'stacks-form'];
const CSS_FILE = 'stacks.css';
const JS_FILE = 'stacks.js';

export default class StackForm extends WebviewBase {
  private static instance: StackForm | null = null;

  private root: vscode.Uri;
  private javaScript: vscode.Uri;
  private css: vscode.Uri;
  private template: HandlebarsTemplateDelegate;

  /**
   * Retrieves a singleton instance of ComponentForm
   * @returns {StackForm} The singleton instance
   */
  public static getInstance(): StackForm {
    if (!StackForm.instance) {
      StackForm.instance = new StackForm();
    }

    return StackForm.instance;
  }

  constructor() {
    super();

    if (WebviewBase.context === null) {
      throw new Error('Extension Context Not Propagated');
    }

    this.root = vscode.Uri.joinPath(WebviewBase.context.extensionUri, ...ROOT_PATH);
    this.javaScript = vscode.Uri.joinPath(this.root, JS_FILE);
    this.css = vscode.Uri.joinPath(this.root, CSS_FILE);

    handlebars.registerHelper('capitalize', (str: string) => {
      return str
        .split('_')
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    });

    this.template = handlebars.compile(this.produceTemplate());
  }

  /**
   * Opens a webview panel with a form to register a new stack
   */
  public async registerForm() {
    const panel = await this.display();
    panel.webview.postMessage({ command: 'register' });
  }

  /**
   * Opens a webview panel with a form to update a specified stack
   * @param {string} id The id of the specified stack
   * @param {string} name The current name of the specified stack
   * @param {object} components The component settings of the specified stack
   */
  public async updateForm(id: string, name: string, components: { [type: string]: string }) {
    const panel = await this.display();
    panel.webview.postMessage({ command: 'update', data: { id, name, components } });
  }

  private async display(): Promise<vscode.WebviewPanel> {
    const panels = Panels.getInstance();
    const existingPanel = panels.getPanel('stack-form');
    if (existingPanel) {
      existingPanel.reveal();
      return existingPanel;
    }

    const panel = panels.createPanel('stack-form', 'Stack Form', {
      enableForms: true,
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    await this.renderForm(panel);
    this.attachListener(panel);
    return panel;
  }

  private attachListener(panel: vscode.WebviewPanel) {
    panel.webview.onDidReceiveMessage(
      async (message: { command: string; data: { [key: string]: string } }) => {
        let success = false;
        const data = message.data;
        const { name, id } = data;
        delete data.name;
        delete data.id;

        switch (message.command) {
          case 'register':
            success = await this.registerStack(name, data);
            if (success) {
              vscode.window.showInformationMessage('Stack registered successfully.');
            }
            break;
          case 'update': {
            const updateData = Object.fromEntries(
              Object.entries(data).map(([type, id]) => [type, [id]])
            );
            success = await this.updateStack(id, name, updateData);
            if (success) {
              vscode.window.showInformationMessage('Stack updated successfully.');
            }
            break;
          }
        }

        if (!success) {
          panel.webview.postMessage({ command: 'fail' });
          return;
        }

        panel.dispose();
        StackDataProvider.getInstance().refresh();
      }
    );
  }

  private async registerStack(
    name: string,
    components: { [type: string]: string }
  ): Promise<boolean> {
    const lsClient = LSClient.getInstance();
    try {
      const resp = await lsClient.sendLsClientRequest('registerStack', [name, components]);

      if ('error' in resp) {
        vscode.window.showErrorMessage(`Unable to register stack: "${resp.error}"`);
        console.error(resp.error);
        traceError(resp.error);
        return false;
      }

      traceInfo(resp.message);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to register stack: "${e}"`);
      console.error(e);
      traceError(e);
      return false;
    }

    return true;
  }

  private async updateStack(
    id: string,
    name: string,
    components: { [key: string]: string[] }
  ): Promise<boolean> {
    const lsClient = LSClient.getInstance();
    try {
      const types = await lsClient.sendLsClientRequest<string[]>('getComponentTypes');
      if (!Array.isArray(types)) {
        throw new Error('Could not get Component Types from LS Server');
      }

      // adding missing types to components object, in case we removed that type.
      types.forEach(type => {
        if (!components[type]) {
          components[type] = [];
        }
      });

      const resp = await lsClient.sendLsClientRequest('updateStack', [id, name, components]);

      if ('error' in resp) {
        vscode.window.showErrorMessage(`Unable to update stack: "${resp.error}"`);
        console.error(resp.error);
        traceError(resp.error);
        return false;
      }

      traceInfo(resp.message);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to update stack: "${e}"`);
      console.error(e);
      traceError(e);
      return false;
    }

    return true;
  }

  private async renderForm(panel: vscode.WebviewPanel) {
    // Track if panel is disposed during loading
    let disposed = false;
    const disposalListener = panel.onDidDispose(() => {
      disposed = true;
    });

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading Stack Form',
          cancellable: false,
        },
        async progress => {
          progress.report({
            message:
              'Fetching flavors and components... (this may take a moment for large workspaces)',
          });

          // Fetch data concurrently for better performance
          const [flavors, components] = await Promise.all([
            getAllFlavors(),
            getAllStackComponents(),
          ]);

          // Check if panel was closed during fetch
          if (disposed) {
            return;
          }

          progress.report({ message: 'Rendering form...' });

          const options = this.convertComponents(flavors, components);
          const js = panel.webview.asWebviewUri(this.javaScript);
          const css = panel.webview.asWebviewUri(this.css);
          const cspSource = panel.webview.cspSource;

          panel.webview.html = this.template({ options, js, css, cspSource });
        }
      );
    } catch (error) {
      // Don't show error if panel was simply closed
      if (disposed) {
        return;
      }

      traceError(error);
      console.error('Failed to load Stack Form:', error);
      vscode.window.showErrorMessage(
        'Failed to load Stack Form. Please check your connection and try again.'
      );

      // Show error state in the panel
      panel.webview.html = this.getErrorHtml();
    } finally {
      disposalListener.dispose();
    }
  }

  /**
   * Returns HTML to display when the form fails to load
   */
  private getErrorHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stack Form Error</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        text-align: center;
        padding: 20px;
      }
      h2 {
        color: var(--vscode-errorForeground);
        margin-bottom: 16px;
      }
      p {
        margin-bottom: 8px;
        max-width: 400px;
      }
    </style>
  </head>
  <body>
    <h2>Failed to Load Stack Form</h2>
    <p>Unable to fetch stack components and flavors from the server.</p>
    <p>Please check your ZenML server connection and try again.</p>
  </body>
</html>
    `;
  }

  // Updated convertComponents method to match your existing types
  private convertComponents(
    flavors: Flavor[],
    components: { [type: string]: StackComponent[] }
  ): { [type: string]: MixedComponent[] } {
    const out: { [type: string]: MixedComponent[] } = {};
    Object.keys(components).forEach(componentType => {
      out[componentType] = components[componentType].map(component => {
        return {
          name: component.name,
          id: component.id,
          url: component.flavor.logo_url || '',
        };
      });
    });

    return out;
  }

  private produceTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src {{cspSource}}; style-src {{cspSource}}; img-src * data:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="{{css}}">
    <title>Stack Form</title>
  </head>
  <body>
    <h2>Register Stack</h2>
    <form>
      <label for="name"><strong>Stack Name:</strong></label> <input type="text" name="name" id="name" required>
      {{#each options}}
        <h3>{{capitalize @key}}</h3>
        <div class="options">
          {{#each this}}
            <div class="single-option">
              <input type="radio" id="{{id}}" name="{{@../key}}" value="{{id}}">
              <label for="{{id}}"><img src="{{url}}"><p>{{capitalize name}}</p></label>
            </div>
          {{/each}}
        </div>
      {{/each}}
      <div class="center"><input type="submit"></div>
    </form>
    <div class="center"><span class="loader hidden"></span></div>
    <script src="{{js}}"></script>
  </body>
</html>
    `;
  }
}
