import { LSClient } from '../services/LSClient';
import {
  ComponentsListResponse,
  Flavor,
  FlavorListResponse,
  StackComponent,
} from '../types/StackTypes';

let flavors: Flavor[] = [];

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
      console.error(`Error retrieving flavors: ${resp.error.toString()}`);
      throw new Error(resp.error);
    }

    maxPage = resp.total_pages;
    flavors = flavors.concat(resp.items);
  } while (page < maxPage);
  return flavors;
};

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
      console.error(`Error retrieving components: ${resp.error.toString()}`);
      throw new Error(resp.error);
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
