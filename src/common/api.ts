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
import { LSClient } from '../services/LSClient';
import {
  ComponentsListResponse,
  Flavor,
  FlavorListResponse,
  StackComponent,
} from '../types/StackTypes';

let flavors: Flavor[] = [];

/**
 * Gets all component flavors and caches them
 * @returns {Flavor[]} List of flavors
 */
export const getAllFlavors = async (): Promise<Flavor[]> => {
  if (flavors.length > 0) {
    return flavors;
  }
  const lsClient = LSClient.getInstance();

  let [page, maxPage] = [0, 1];
  do {
    page++;
    const resp = await lsClient.sendLsClientRequest<FlavorListResponse>('listFlavors', [
      page,
      10000,
    ]);

    if ('error' in resp) {
      console.error(`Error retrieving flavors: ${resp.error}`);
      throw new Error(`Error retrieving flavors: ${resp.error}`);
    }

    maxPage = resp.total_pages;
    flavors = flavors.concat(resp.items);
  } while (page < maxPage);
  return flavors;
};

/**
 * Gets all flavors of a specified component type
 * @param {string} type Type of component to filter by
 * @returns {Flavor[]} List of flavors that match the component type filter
 */
export const getFlavorsOfType = async (type: string): Promise<Flavor[]> => {
  const flavors = await getAllFlavors();
  return flavors.filter(flavor => flavor.type === type);
};

/**
 * Gets a specific flavor
 * @param {string} name The name of the flavor to get
 * @returns {Flavor} The specified flavor.
 */
export const getFlavor = async (name: string): Promise<Flavor> => {
  const flavors = await getAllFlavors();
  const flavor = flavors.find(flavor => flavor.name === name);

  if (!flavor) {
    throw Error(`getFlavor: Flavor ${name} not found`);
  }

  return flavor;
};

/**
 * Gets all stack components
 * @returns {object} Object containing all components keyed by each type.
 */
export const getAllStackComponents = async (): Promise<{
  [type: string]: StackComponent[];
}> => {
  const lsClient = LSClient.getInstance();
  let components: StackComponent[] = [];
  let [page, maxPage] = [0, 1];

  do {
    page++;
    const resp = await lsClient.sendLsClientRequest<ComponentsListResponse>('listComponents', [
      page,
      10000,
    ]);

    if ('error' in resp) {
      console.error(`Error retrieving components: ${resp.error}`);
      throw new Error(`Error retrieving components: ${resp.error}`);
    }

    maxPage = resp.total_pages;
    components = components.concat(resp.items);
  } while (page < maxPage);

  const out: { [type: string]: StackComponent[] } = {};
  components.forEach(component => {
    if (!(component.type in out)) {
      out[component.type] = [];
    }
    out[component.type].push(component);
  });

  return out;
};
