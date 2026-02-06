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

import { ZenServerDetails } from './ServerInfoTypes';
import { Components } from './StackTypes';

/***** Generic Response Types *****/
export interface SuccessMessageResponse {
  message: string;
}

export interface ErrorMessageResponse {
  error: string;
  message: string;
}

export interface VersionMismatchError {
  error: string;
  message: string;
  clientVersion: string;
  serverVersion: string;
}

export type GenericLSClientResponse = SuccessMessageResponse | ErrorMessageResponse;

/***** Server Response Types *****/
export interface RestServerConnectionResponse {
  message: string;
  access_token: string;
}

export type ServerStatusInfoResponse =
  | ZenServerDetails
  | VersionMismatchError
  | ErrorMessageResponse;
export type ConnectServerResponse =
  | RestServerConnectionResponse
  | SuccessMessageResponse
  | ErrorMessageResponse;

/***** Stack Response Types *****/
export interface ActiveStackResponse {
  id: string;
  name: string;
  components: Components;
}

export type SetActiveStackResponse = ActiveStackResponse | ErrorMessageResponse;
export type GetActiveStackResponse = ActiveStackResponse | ErrorMessageResponse;

/***** Project Response Types *****/
export interface ActiveProjectResponse {
  id: string;
  name: string;
  display_name?: string;
  created?: string;
  updated?: string;
}

export type SetActiveProjectResponse = ActiveProjectResponse | ErrorMessageResponse;
export type GetActiveProjectResponse = ActiveProjectResponse | ErrorMessageResponse;
