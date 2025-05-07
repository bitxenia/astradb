import { ConnectionManager } from "./connectionManager.js";
import { AstraDb, AstraDbInit } from "./index.js";
import {
  startOrbitDb,
  getPrivateKey,
  getPublicKey,
} from "./utils/startOrbitdb.js";
import { KeyRepository } from "./keyRepository.js";
import EventEmitter from "events";
import { OrbitDB } from "@orbitdb/core";

export class AstraDbNode implements AstraDb {
  dbName: string;
  private orbitdb: OrbitDB;
  private connectionManager: ConnectionManager;
  private keyRepository: KeyRepository;
  events: EventEmitter;

  constructor(dbName: string) {
    this.dbName = dbName;
    this.events = new EventEmitter();
  }

  public async init(initOptions: AstraDbInit): Promise<void> {
    const dataDir = `${initOptions.dataDir}/astradb`;

    this.orbitdb = await startOrbitDb(
      initOptions.loginKey,
      initOptions.datastore,
      initOptions.blockstore,
      initOptions.publicIp,
      initOptions.TcpPort,
      initOptions.WSPort,
      initOptions.WSSPort,
      dataDir
    );
    // Initialize the connection manager if we are not in offline mode.
    if (!initOptions.offlineMode) {
      this.connectionManager = new ConnectionManager(
        this.dbName,
        this.orbitdb.ipfs
      );
    }
    await this.connectionManager.init(initOptions.isCollaborator);

    this.keyRepository = new KeyRepository(
      this.dbName,
      this.orbitdb,
      initOptions.isCollaborator,
      this.events
    );
    await this.keyRepository.init(initOptions.offlineMode);
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

  public getLoginPublicKey(): string {
    // Get the user login public key from orbitdb.
    return getPublicKey(this.orbitdb);
  }

  public async getLoginPrivateKey(): Promise<string> {
    // Get the user login private key from orbitdb.
    return await getPrivateKey(this.orbitdb);
  }
}
