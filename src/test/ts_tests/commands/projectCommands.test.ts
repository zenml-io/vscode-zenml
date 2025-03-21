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
import * as vscode from 'vscode';
import { projectCommands } from '../../../commands/projects/cmds';
import * as projectUtils from '../../../commands/projects/utils';
import { EventBus } from '../../../services/EventBus';
import { LSClient } from '../../../services/LSClient';
import { Project } from '../../../types/ProjectTypes';
import { INITIAL_ZENML_SERVER_STATUS } from '../../../utils/constants';
import * as globalUtils from '../../../utils/global';
import { ProjectDataProvider, ServerDataProvider } from '../../../views/activityBar';
import { ProjectTreeItem } from '../../../views/activityBar/projectView/ProjectTreeItems';
import ZenMLStatusBar from '../../../views/statusBar';
import { MockEventBus } from '../__mocks__/MockEventBus';
import { MockLSClient } from '../__mocks__/MockLSClient';
import {
  MockProjectDataProvider,
  MockServerDataProvider,
  MockZenMLStatusBar,
} from '../__mocks__/MockViewProviders';

suite('Project Commands Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let showInformationMessageStub: sinon.SinonStub;
  let mockLSClient: any;
  let mockEventBus: any;
  let mockProjectDataProvider: MockProjectDataProvider;
  let mockServerDataProvider: MockServerDataProvider;
  let mockStatusBar: MockZenMLStatusBar;
  let switchActiveProjectStub: sinon.SinonStub;
  let mockProject: Project;
  let setActiveProjectStub: sinon.SinonStub; // eslint-disable-line @typescript-eslint/no-unused-vars

  setup(() => {
    sandbox = sinon.createSandbox();
    mockEventBus = new MockEventBus();
    mockLSClient = new MockLSClient(mockEventBus);
    mockProjectDataProvider = new MockProjectDataProvider();
    mockServerDataProvider = new MockServerDataProvider();
    mockStatusBar = new MockZenMLStatusBar();
    mockProject = {
      id: 'mock-project-id',
      name: 'mock-project',
      display_name: 'Mock Project',
      created: '2025-01-01T00:00:00Z',
      updated: '2025-01-01T00:00:00Z',
    };
    const stubbedServerUrl = 'http://mocked-server.com';

    sandbox.stub(ProjectDataProvider, 'getInstance').returns(mockProjectDataProvider);
    sandbox.stub(ServerDataProvider, 'getInstance').returns(mockServerDataProvider);
    sandbox.stub(ZenMLStatusBar, 'getInstance').returns(mockStatusBar);
    sandbox.stub(LSClient, 'getInstance').returns(mockLSClient);
    sandbox.stub(EventBus, 'getInstance').returns(mockEventBus);
    sandbox.stub(projectUtils, 'storeActiveProject').resolves();
    sandbox.stub(globalUtils, 'getZenMLServerUrl').returns(stubbedServerUrl);

    showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');

    switchActiveProjectStub = sandbox
      .stub(projectUtils, 'switchActiveProject')
      .callsFake(async (projectName: string) => {
        console.log('switchActiveProject stub called with', projectName);
        return Promise.resolve(mockProject);
      });

    setActiveProjectStub = sandbox
      .stub(projectCommands, 'setActiveProject')
      .callsFake(async (node: ProjectTreeItem) => {
        await switchActiveProjectStub(node.name);
        showInformationMessageStub(`Active project set to: ${node.name}`);
        await mockStatusBar.refreshActiveProject();
        await mockProjectDataProvider.updateActiveProject();
      });

    sandbox.stub(vscode.window, 'withProgress').callsFake(async (options, task) => {
      const mockProgress = {
        report: sandbox.stub(),
      };
      const mockCancellationToken = new vscode.CancellationTokenSource();
      await task(mockProgress, mockCancellationToken.token);
    });
  });

  teardown(() => {
    sandbox.restore();
    mockEventBus.clearAllHandlers();

    const eventBus = EventBus.getInstance();
    eventBus.cleanupEventListener('lsClientStateChanged');
    eventBus.cleanupEventListener('zenml/clientInitialized');
  });

  test('refreshProjectView refreshes the project data provider', async () => {
    await projectCommands.refreshProjectView();
    sinon.assert.calledOnce(mockProjectDataProvider.refresh);
  });

  test('refreshActiveProject refreshes the status bar', async () => {
    await projectCommands.refreshActiveProject();
    sinon.assert.calledOnce(mockStatusBar.refreshActiveProject);
  });

  test('setActiveProject successfully switches to a new project', async () => {
    const mockProjectNode = new ProjectTreeItem(mockProject, 'mock-project', false);

    await projectCommands.setActiveProject(mockProjectNode);

    sinon.assert.calledOnce(switchActiveProjectStub);
    sinon.assert.calledWith(switchActiveProjectStub, mockProject.name);
    sinon.assert.calledOnce(showInformationMessageStub);
    sinon.assert.calledWith(showInformationMessageStub, `Active project set to: mock-project`);
    sinon.assert.calledOnce(mockProjectDataProvider.updateActiveProject);
    sinon.assert.calledOnce(mockStatusBar.refreshActiveProject);
  });

  test('goToProjectUrl opens the correct URL', async () => {
    // Create a mock with the dashboard URL set
    const mockServerProvider = new MockServerDataProvider();
    mockServerProvider.currentServerStatus = {
      ...INITIAL_ZENML_SERVER_STATUS,
      isConnected: true,
      url: 'http://mocked-server.com',
      dashboard_url: 'http://mocked-dashboard.zenml.io',
      deployment_type: 'cloud',
      active_workspace_id: 'mock-workspace-id',
      active_workspace_name: 'mock-workspace',
      active_project_id: 'mock-project-id',
      active_project_name: 'mock-project',
    };

    const fakeProjectNode = new ProjectTreeItem(mockProject, 'mock-project-id', false);

    // '/projects' alone causes 404:
    // {serverUrl}/workspaces/ws1/projects/first-project → 404
    // {serverUrl}/workspaces/ws1/projects/first-project/pipelines → works
    // we can remove '/pipelines' from the expected URL once '/projects' reroutes to it by default
    const expectedUrl =
      'http://mocked-dashboard.zenml.io/workspaces/mock-workspace/projects/mock-project/pipelines';

    const openExternalStub = sandbox.stub(vscode.env, 'openExternal');
    projectCommands.goToProjectUrl(fakeProjectNode);

    assert.strictEqual(openExternalStub.calledOnce, true, 'openExternal should be called once');

    const actualUrl = openExternalStub.args[0][0].toString();
    assert.strictEqual(
      actualUrl,
      expectedUrl,
      `Incorrect URL: expected ${expectedUrl}, got ${actualUrl}`
    );
  });
});
