import * as vscode from 'vscode';
import { getGlobalSettings, getWorkspaceSettings } from '../../../common/settings';
import { EnvironmentItem } from './EnvironmentItem';
import { SERVER_ID } from '../../../common/constants';
import { getProjectRoot } from '../../../common/utilities';
import { PYTOOL_MODULE } from '../../../utils/constants';

export class EnvironmentDataProvider implements vscode.TreeDataProvider<EnvironmentItem> {
  private static instance: EnvironmentDataProvider | null = null;
  private _onDidChangeTreeData: vscode.EventEmitter<EnvironmentItem | undefined | void> = new vscode.EventEmitter<EnvironmentItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<EnvironmentItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() { }

  /**
   * Retrieves the singleton instance of ServerDataProvider.
   *
   * @returns {PipelineDataProvider} The singleton instance.
   */
  public static getInstance(): EnvironmentDataProvider {
    if (!this.instance) {
      this.instance = new EnvironmentDataProvider();
    }
    return this.instance;
  }

  /**
   * Refreshes the "Pipeline Runs" view by fetching the latest pipeline run data and updating the view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }


  /**
   * Retrieves the tree item for a given pipeline run.
   *
   * @param element The pipeline run item.
   * @returns The corresponding VS Code tree item.
   */
  getTreeItem(element: EnvironmentItem): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieves the children for a given tree item.
   * 
   * @param element The parent tree item. If undefined, root pipeline runs are fetched.
   * @returns A promise resolving to an array of child tree items or undefined if there are no children.
   */
  async getChildren(element?: EnvironmentItem): Promise<EnvironmentItem[]> {
    if (!element) {
      // Root elements: Global and Workspace settings
      return [new EnvironmentItem('Global Settings', '', vscode.TreeItemCollapsibleState.Collapsed),
      new EnvironmentItem('Workspace Settings', '', vscode.TreeItemCollapsibleState.Collapsed)];
    } else {
      const settings = element.label === 'Global Settings'
        ? await getGlobalSettings('zenml', true)
        : await getWorkspaceSettings(PYTOOL_MODULE, await getProjectRoot(), true);

      console.log(settings)
      return [
        new EnvironmentItem('cwd', settings.cwd),
        new EnvironmentItem('workspace', settings.workspace),
        new EnvironmentItem('path', settings.path.join('; ')),
        new EnvironmentItem('interpreter', settings.interpreter.join('; '))
      ];

    }
  }
}