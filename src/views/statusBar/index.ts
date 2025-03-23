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
import {
  MarkdownString,
  QuickPickItem,
  QuickPickItemKind,
  StatusBarAlignment,
  StatusBarItem,
  ThemeColor,
  ThemeIcon,
  commands,
  window,
} from 'vscode';
import { getActiveProject, switchActiveProject } from '../../commands/projects/utils';
import { getActiveStack, switchActiveStack } from '../../commands/stack/utils';
import { EventBus } from '../../services/EventBus';
import {
  MainMenuQuickPickItem,
  ProjectQuickPickItem,
  StackQuickPickItem,
} from '../../types/QuickPickItemTypes';
import { StatusBarServerStatus } from '../../types/ServerInfoTypes';
import {
  LSP_ZENML_PROJECT_CHANGED,
  LSP_ZENML_STACK_CHANGED,
  SERVER_STATUS_UPDATED,
} from '../../utils/constants';
import { ProjectDataProvider, StackDataProvider } from '../activityBar';
import { ErrorTreeItem } from '../activityBar/common/ErrorTreeItem';
import { ProjectTreeItem } from '../activityBar/projectView/ProjectTreeItems';

/**
 * Represents the ZenML extension's status bar.
 * This class manages two main status indicators: the server status and the active stack name.
 */
export default class ZenMLStatusBar {
  private static instance: ZenMLStatusBar;
  private statusBarItem: StatusBarItem;
  private serverStatus = { isConnected: false, serverUrl: '' };
  private activeStack: string = '';
  private activeStackId: string = '';
  private activeProjectName: string = '';
  private isLoadingStack: boolean = false;
  private isLoadingProject: boolean = false;
  private eventBus = EventBus.getInstance();

  /**
   * Initializes a new instance of the ZenMLStatusBar class.
   * Sets up the status bar items for server status and active stack, subscribes to server status updates,
   * and initiates the initial refresh of the status bar state.
   */
  constructor() {
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.subscribeToEvents();
    this.statusBarItem.command = 'zenml/statusBar/openSwitchMenu';
  }

  /**
   * Registers the commands associated with the ZenMLStatusBar.
   */
  public registerCommands(): void {
    commands.registerCommand('zenml/statusBar/openSwitchMenu', () => this.showContextMenu());
  }

  /**
   * Subscribes to relevant events to trigger a refresh of the status bar.
   *
   * @returns void
   */
  private subscribeToEvents(): void {
    this.eventBus.off(LSP_ZENML_STACK_CHANGED, this.refreshActiveStack);
    this.eventBus.off(LSP_ZENML_PROJECT_CHANGED, this.refreshActiveProject);
    this.eventBus.off(SERVER_STATUS_UPDATED, this.serverStatusUpdateHandler);

    this.eventBus.on(LSP_ZENML_STACK_CHANGED, this.stackChangeHandler);
    this.eventBus.on(LSP_ZENML_PROJECT_CHANGED, this.projectChangeHandler);
    this.eventBus.on(SERVER_STATUS_UPDATED, this.serverStatusUpdateHandler);
  }

  /**
   * Updates the status bar item with the server status and active stack information.
   *
   * @param {StatusBarServerStatus} The server status and active stack information.
   */
  private serverStatusUpdateHandler = ({ isConnected, serverUrl }: StatusBarServerStatus) => {
    this.serverStatus = { isConnected, serverUrl };
    this.updateStatusBarItem();
  };

  /**
   * Handles the project change event.
   *
   * @param {string} projectName The name of the active project.
   */
  private projectChangeHandler = async (projectName: string) => {
    if (this.activeProjectName !== projectName) {
      this.activeProjectName = projectName;
      await this.refreshActiveProject();
    }
  };

  /**
   * Handles the stack change event.
   *
   * @param {string} stackId The ID of the active stack.
   */
  private stackChangeHandler = async (stackId: string) => {
    if (this.activeStackId !== stackId) {
      this.activeStackId = stackId;
      await this.refreshActiveStack();
    }
  };
  /**
   * Retrieves or creates an instance of the ZenMLStatusBar.
   * This method implements the Singleton pattern to ensure that only one instance of ZenMLStatusBar exists.
   *
   * @returns {ZenMLStatusBar} The singleton instance of the ZenMLStatusBar.
   */
  public static getInstance(): ZenMLStatusBar {
    if (!ZenMLStatusBar.instance) {
      ZenMLStatusBar.instance = new ZenMLStatusBar();
    }
    return ZenMLStatusBar.instance;
  }

  /**
   * Shows a loading indicator in the status bar.
   */
  private showLoading(): void {
    this.statusBarItem.text = '$(loading~spin) Loading...';
    this.statusBarItem.show();
  }

  /**
   * Asynchronously refreshes the active stack display in the status bar.
   * Attempts to retrieve the current active stack name and updates the status bar item accordingly.
   */
  public async refreshActiveStack(): Promise<void> {
    this.showLoading();
    this.isLoadingStack = true;
    try {
      const activeStack = await getActiveStack();
      this.activeStackId = activeStack?.id || '';
      this.activeStack = activeStack?.name || 'default';
    } catch (error) {
      console.error('Failed to fetch active ZenML stack:', error);
      this.activeStack = 'Error';
    } finally {
      this.isLoadingStack = false;
      this.updateStatusBarItem();
    }
  }

  /**
   * Asynchronously refreshes the active project display in the status bar.
   * Attempts to retrieve the current active project name and updates the status bar accordingly.
   */
  public async refreshActiveProject(): Promise<void> {
    this.showLoading();
    this.isLoadingProject = true;
    try {
      const activeProject = await getActiveProject();
      this.activeProjectName = activeProject?.name || '(not set)';
    } catch (error) {
      console.error('Failed to fetch active ZenML project:', error);
      this.activeProjectName = 'Error';
    } finally {
      this.isLoadingProject = false;
      this.updateStatusBarItem();
    }
  }

  /**
   * Refreshes both active stack and project information.
   */
  public async refresh(): Promise<void> {
    await Promise.all([this.refreshActiveStack(), this.refreshActiveProject()]);
  }

  /**
   * Shows a context menu with options to switch stack or project
   *
   * @returns {Promise<void>} A promise that resolves when the menu is shown
   */
  private async showContextMenu(): Promise<void> {
    const menuItems: MainMenuQuickPickItem[] = [
      {
        label: `Switch Stack (current: ${this.activeStack})`,
        description: 'Change the active ZenML stack',
        id: 'switchStack',
        iconPath: new ThemeIcon('layers'),
      },
      {
        label: `Switch Project (current: ${this.activeProjectName || '(not set)'})`,
        description: 'Change the active ZenML project',
        id: 'switchProject',
        iconPath: new ThemeIcon('symbol-method'),
      },
    ];

    const selectedItem = await window.showQuickPick(menuItems, {
      placeHolder: 'ZenML Options',
      matchOnDescription: true,
      ignoreFocusOut: true, // keep menu open when focus is lost
    });

    if (selectedItem) {
      if (selectedItem.id === 'switchStack') {
        await this.switchStack();
      } else if (selectedItem.id === 'switchProject') {
        await this.switchProject();
      }
    }
  }

  /**
   * Switches the active stack by prompting the user to select a stack from the available options.
   *
   * @returns {Promise<void>} A promise that resolves when the active stack has been successfully switched.
   */
  private async switchStack(): Promise<void> {
    const stackProvider = StackDataProvider.getInstance();
    const { items } = stackProvider;
    if (items.some(stack => stack instanceof ErrorTreeItem) || items.length === 0) {
      window.showErrorMessage('No stacks available.');
      return;
    }
    const activeStackItem = items.find(stack => stack.id === this.activeStackId);
    const otherStacks = items.filter(stack => stack.id !== this.activeStackId);

    const quickPickItems: (StackQuickPickItem | QuickPickItem)[] = [
      { label: 'Current Active Stack', kind: QuickPickItemKind.Separator },
      {
        label: activeStackItem?.label as string,
        id: activeStackItem?.id,
        kind: QuickPickItemKind.Default,
        description: '(current)',
        iconPath: new ThemeIcon('check', new ThemeColor('charts.green')),
        disabled: true,
      },
      { label: 'Available Stacks', kind: QuickPickItemKind.Separator },
      ...otherStacks.map(stack => ({
        id: stack.id,
        label: stack.label as string,
        kind: QuickPickItemKind.Default,
        iconPath: new ThemeIcon('layers'),
      })),
    ];

    // Temporarily disable tooltip
    this.statusBarItem.tooltip = undefined;
    const selectedStack = await window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a stack to switch to',
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true,
    });

    if (selectedStack && 'id' in selectedStack && selectedStack.id !== this.activeStackId) {
      this.showLoading();
      const newStackId = otherStacks.find(stack => stack.label === selectedStack.label)?.id;
      if (newStackId) {
        try {
          await switchActiveStack(newStackId);
          StackDataProvider.getInstance().updateActiveStack(newStackId);
          this.activeStackId = newStackId;
          this.activeStack = selectedStack.label;
          window.showInformationMessage(`Successfully switched to stack: ${selectedStack.label}`);
        } catch (error) {
          window.showErrorMessage(
            `Failed to switch stack: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        window.showErrorMessage('Failed to find stack ID for the selected stack.');
      }
    }

    this.updateStatusBarItem();
  }

  /**
   * Switches the active project by prompting the user to select a project from the available options.
   *
   * @returns {Promise<void>} A promise that resolves when the active project has been successfully switched
   */
  private async switchProject(): Promise<void> {
    const projectProvider = ProjectDataProvider.getInstance();
    const items = projectProvider.items;
    if (items.some(project => project instanceof ErrorTreeItem) || items.length === 0) {
      window.showErrorMessage('No projects available.');
      return;
    }
    const projectItems = items.filter(item => item instanceof ProjectTreeItem) as ProjectTreeItem[];
    if (!projectItems.length) {
      window.showErrorMessage('No projects available.');
      return;
    }
    const activeProjectItem = projectItems.find(
      project => project.project.name === this.activeProjectName
    );
    const otherProjects = projectItems.filter(
      project => project.project.name !== this.activeProjectName
    );

    const quickPickItems: (ProjectQuickPickItem | QuickPickItem)[] = [
      { label: 'Current Active Project', kind: QuickPickItemKind.Separator },
      activeProjectItem
        ? {
            label: activeProjectItem.project.name,
            id: activeProjectItem.project.id,
            kind: QuickPickItemKind.Default,
            description: '(current)',
            iconPath: new ThemeIcon('check', new ThemeColor('charts.green')),
            disabled: true,
          }
        : {
            label: '(No active project)',
            kind: QuickPickItemKind.Default,
            iconPath: new ThemeIcon('warning'),
            disabled: true,
          },
      { label: 'Available Projects', kind: QuickPickItemKind.Separator },
      ...otherProjects.map(project => ({
        id: project.project.id,
        name: project.project.name,
        label: project.project.name,
        kind: QuickPickItemKind.Default,
        iconPath: new ThemeIcon('symbol-method'),
      })),
    ];

    this.statusBarItem.tooltip = undefined;
    const selectedProject = await window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a project to switch to',
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true,
    });

    if (
      selectedProject &&
      'name' in selectedProject &&
      selectedProject.name !== this.activeProjectName
    ) {
      this.showLoading();
      try {
        const projectName = selectedProject.name;
        if (projectName) {
          await switchActiveProject(projectName);
          projectProvider.updateActiveProject(projectName);
          this.activeProjectName = projectName;
          window.showInformationMessage(`Successfully switched to project: ${projectName}`);
        } else {
          window.showErrorMessage('Selected project name is undefined.');
        }
      } catch (error) {
        window.showErrorMessage(
          `Failed to switch project: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    this.updateStatusBarItem();
  }

  /**
   * Updates the status bar item with the server status and active stack information.
   */
  private updateStatusBarItem(): void {
    this.statusBarItem.text =
      this.isLoadingStack || this.isLoadingProject
        ? '$(loading~spin) Loading...'
        : this.activeProjectName
          ? `$(symbol-method) ${this.activeProjectName} | $(layers) ${this.activeStack}`
          : `$(layers) ${this.activeStack}`;
    this.updateStatusBarTooltip();
    this.statusBarItem.show();
  }

  /**
   * Updates the status bar tooltip with current information
   */
  private updateStatusBarTooltip(): void {
    const serverStatusText = this.serverStatus.isConnected
      ? 'Connected ✅'
      : 'Disconnected (local)';
    const tooltip = new MarkdownString();
    tooltip.appendMarkdown(`**Server Status:** ${serverStatusText}  \n`);
    tooltip.appendMarkdown(`**Active Project:** ${this.activeProjectName || '(not set)'}  \n`);
    tooltip.appendMarkdown(`**Active Stack:** ${this.activeStack}  \n\n`);
    tooltip.appendMarkdown(`[Switch Project or Stack](command:zenml/statusBar/openSwitchMenu)`);
    tooltip.isTrusted = true;
    this.statusBarItem.tooltip = tooltip;
  }
}
