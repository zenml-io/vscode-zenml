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
import { StackDataProvider } from '../../../views/activityBar';
import { ServerDataProvider } from '../../../views/activityBar';
import { ServerStatus, ZenServerDetails } from '../../../types/ServerStatusTypes';
import { INITIAL_ZENML_SERVER_STATUS } from '../../../utils/constants';
import ZenMLStatusBar from '../../../views/statusBar';
import sinon from 'sinon';

export class MockZenMLStatusBar extends ZenMLStatusBar {
  public refreshActiveStack = sinon.stub().resolves();
}

export class MockStackDataProvider extends StackDataProvider {
  public refresh = sinon.stub().resolves();
}


export class MockServerDataProvider extends ServerDataProvider {
  public refreshCalled: boolean = false;
  public currentServerStatus: ServerStatus = INITIAL_ZENML_SERVER_STATUS;

  public async refresh(updatedServerConfig?: ZenServerDetails): Promise<void> {
    this.refreshCalled = true;
    if (updatedServerConfig) {
      this.currentServerStatus = {
        ...updatedServerConfig.storeInfo,
        isConnected: updatedServerConfig.storeConfig.type === 'rest',
        url: updatedServerConfig.storeConfig.url,
        store_type: updatedServerConfig.storeConfig.type,
      }
    }
  }

  public resetMock(): void {
    this.refreshCalled = false;
    this.currentServerStatus = INITIAL_ZENML_SERVER_STATUS;
  }
}

