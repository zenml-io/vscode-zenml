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

import * as vscode from 'vscode';
import WebviewBase from '../../common/WebviewBase';
import { handlebars } from 'hbs';
import Panels from '../../common/panels';
import { getAllFlavors, getAllStackComponents } from '../../common/api';
import { Flavor, StackComponent } from '../../types/StackTypes';
import { LSClient } from '../../services/LSClient';
import { StackDataProvider } from '../../views/activityBar';
import { traceError, traceInfo } from '../../common/log/logging';

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
   * Opens a webview panel with a form to create a new stack
   */
  public async createForm() {
    const panel = await this.display();
    panel.webview.postMessage({ command: 'create' });
  }

  /**
   * Opens a webview panel with a form to update a specified stack
   * @param {string} id The id of the specified stack
   * @param {string} name The current name of the specified stack
   * @param {object} components The component settings of the sepcified stack
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
          case 'create':
            success = await this.createStack(name, data);
            break;
          case 'update': {
            const updateData = Object.fromEntries(
              Object.entries(data).map(([type, id]) => [type, [id]])
            );
            success = await this.updateStack(id, name, updateData);
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

  private async createStack(
    name: string,
    components: { [type: string]: string }
  ): Promise<boolean> {
    const lsClient = LSClient.getInstance();
    try {
      const resp = await lsClient.sendLsClientRequest('createStack', [name, components]);

      if ('error' in resp) {
        vscode.window.showErrorMessage(`Unable to create stack: "${resp.error}"`);
        console.error(resp.error);
        traceError(resp.error);
        return false;
      }

      traceInfo(resp.message);
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to create stack: "${e}"`);
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
    const flavors = await getAllFlavors();
    const components = await getAllStackComponents();
    const options = this.convertComponents(flavors, components);
    const js = panel.webview.asWebviewUri(this.javaScript);
    const css = panel.webview.asWebviewUri(this.css);

    panel.webview.html = this.template({ options, js, css });
  }

  private convertComponents(
    flavors: Flavor[],
    components: { [type: string]: StackComponent[] }
  ): { [type: string]: MixedComponent[] } {
    const out: { [type: string]: MixedComponent[] } = {};

    Object.keys(components).forEach(key => {
      out[key] = components[key].map(component => {
        return {
          name: component.name,
          id: component.id,
          url:
            flavors.find(
              flavor => flavor.type === component.type && flavor.name === component.flavor
            )?.logo_url ?? '',
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
    <meta http-equiv="Content-Secuirty-Policy" content="default-src 'none';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="{{css}}">
    <title>Stack Form</title>
  </head>
  <body>
    <h2>Create Stack</h2>
    <form>
      <label for="name" required><strong>Stack Name:</strong></label> <input type="text" name="name" id="name">
      {{#each options}}
        <h3>{{capitalize @key}}</h3>
        <div class="options">
          {{#each this}}
            <div class="single-option">
              <input type="radio" id="{{id}}" name="{{@../key}}" value={{id}}>
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
