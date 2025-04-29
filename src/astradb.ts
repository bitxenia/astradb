import { ConnectionManager } from "./connectionManager.js";
import { AstraDb } from "./index.js";
import { startOrbitDb } from "./utils/startOrbitdb.js";
import { KeyRepository } from "./keyRepository.js";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";

export class AstraDbNode implements AstraDb {
  dbName: string;
  private connectionManager: ConnectionManager;
  private keyRepository: KeyRepository;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  public async init(
    isCollaborator: boolean,
    datastore: Datastore,
    blockstore: Blockstore,
    publicIp: string
  ): Promise<void> {
    if (isCollaborator) {
      if (!datastore || !blockstore) {
        throw new Error(
          "A collaborator node must use a persistent datastore and blockstore."
        );
      }
    }
    const orbitdb = await startOrbitDb(datastore, blockstore, publicIp);
    this.connectionManager = new ConnectionManager(this.dbName, orbitdb.ipfs);
    await this.connectionManager.init(isCollaborator);

    this.keyRepository = new KeyRepository(
      this.dbName,
      orbitdb,
      isCollaborator
    );
    await this.keyRepository.init();
  }

  public async add(key: string, value: string): Promise<void> {
    // Add the key to the key repository.
    await this.keyRepository.add(key, value);
  }

  public async get(key: string): Promise<string> {
    // Get the value from the key repository.
    return await this.keyRepository.get(key);
  }

  public async getAllKeys(): Promise<string[]> {
    // Get all keys from the key repository.
    return await this.keyRepository.getAllKeys();
  }
}
