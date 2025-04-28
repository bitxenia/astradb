import { AstraDb } from "./index.js";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";

export class AstraDbNode implements AstraDb {
  dbName: string;

  public async init(
    dbName: string,
    isCollaborator: boolean,
    datastore: Datastore,
    blockstore: Blockstore,
    publicIp: string
  ): Promise<void> {
    if (isCollaborator) {
      if (!datastore || !blockstore) {
        throw new Error(
          "A collaborator node should use a persistent datastore and blockstore."
        );
      }
    }
  }

  public async add(key: string, value: string): Promise<void> {
    return;
  }

  public async get(key: string): Promise<string> {
    return;
  }

  public async getAllKeys(): Promise<string[]> {
    return [];
  }
}
