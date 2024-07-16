import * as vscode from 'vscode';

export default class Panels {
  private static instance: Panels | undefined;
  private openPanels: { [id: string]: vscode.WebviewPanel };

  constructor() {
    this.openPanels = {};
  }

  public static getInstance(): Panels {
    if (Panels.instance === undefined) {
      Panels.instance = new Panels();
    }
    return Panels.instance;
  }

  public createPanel(
    id: string,
    label: string,
    options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
  ) {
    const panel = vscode.window.createWebviewPanel(id, label, vscode.ViewColumn.One, options);
    panel.webview.html = this.getLoadingContent();

    this.openPanels[id] = panel;

    panel.onDidDispose(() => {
      this.deregisterPanel(id);
    }, null);

    return panel;
  }

  private deregisterPanel(id: string) {
    delete this.openPanels[id];
  }

  public getPanel(id: string): vscode.WebviewPanel | undefined {
    return this.openPanels[id];
  }

  private getLoadingContent(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Secuirty-Policy" content="default-src 'none';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading</title>
    <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; }
        .spinner {
            border: 8px solid #f3f3f3;
            border-top: 8px solid #3498db;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 2s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="spinner"></div>
</body>
</html>`;
  }
}
