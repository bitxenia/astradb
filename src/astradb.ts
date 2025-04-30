import { ConnectionManager } from "./connectionManager.js";
import { AstraDb, AstraDbInit } from "./index.js";
import { startOrbitDb } from "./utils/startOrbitdb.js";
import { KeyRepository } from "./keyRepository.js";

export class AstraDbNode implements AstraDb {
  dbName: string;
  private connectionManager: ConnectionManager;
  private keyRepository: KeyRepository;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  public async init(initOptions: AstraDbInit): Promise<void> {
    const orbitdb = await startOrbitDb(
      initOptions.datastore,
      initOptions.blockstore,
      initOptions.publicIp,
      initOptions.TcpPort,
      initOptions.WSPort,
      initOptions.WSSPort
    );
    this.connectionManager = new ConnectionManager(this.dbName, orbitdb.ipfs);
    await this.connectionManager.init(initOptions.isCollaborator);

    this.keyRepository = new KeyRepository(
      this.dbName,
      orbitdb,
      initOptions.isCollaborator
    );
    await this.keyRepository.init();
  }

  public async add(key: string, value: string): Promise<void> {
    // Add the key to the key repository.
    await this.keyRepository.add(key, value);
  }

  public async get(key: string): Promise<string[]> {
    // Get the value from the key repository.
    return await this.keyRepository.get(key);
  }

  public async getAllKeys(): Promise<string[]> {
    // Get all keys from the key repository.
    return await this.keyRepository.getAllKeys();
  }
}
