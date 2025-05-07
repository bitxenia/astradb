import { OrbitDB } from "@orbitdb/core";
import { Database } from "./database.js";
import EventEmitter from "events";
import { Mutex } from "async-mutex";

export class KeyRepository {
  dbName: string;
  orbitdb: OrbitDB;
  isCollaborator: boolean;
  keyDb: Database;
  keys: Set<string>;
  keyDbs: Map<string, Database>;
  events: EventEmitter;
  mutex: Mutex;

  constructor(
    dbName: string,
    orbitdb: OrbitDB,
    isCollaborator: boolean,
    events: EventEmitter
  ) {
    this.dbName = dbName;
    this.orbitdb = orbitdb;
    this.isCollaborator = isCollaborator;
    this.keys = new Set<string>();
    this.keyDbs = new Map<string, Database>();
    this.events = events;
    this.mutex = new Mutex();
  }

  public async init(offlineMode: boolean): Promise<void> {
    this.keyDb = new Database(
      this.dbName,
      this.orbitdb,
      this.events,
      this.newKeyAdded.bind(this)
    );

    if (!this.isCollaborator && !offlineMode) {
      // If we are not a collaborator and we are not in offline mode, we open an existing database which sincronizes with the providers.
      const synced = await this.keyDb.initExisting();
      if (!synced) {
        // If we are not a collaborator and the db did not sync with the providers,
        // We throw an error because a non collaborator node cannot create a new astradb.
        throw Error(`No providers found for the key repository database`);
      }
    } else {
      // If we are a collaborator, we create a new database,
      // because it is not necessary to sync with the providers immediately.
      await this.keyDb.initNew();
    }
  }

  public async add(key: string, value: string): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (!this.keys.has(key)) {
        // If the key does not exist, we add it to the keys set and to the database.
        this.keys.add(key);
        await this.keyDb.add(key);
        console.log(`Key ${key} added to the key repository`);
      }
      const valueDb = await this.getValueDb(key, false);

      // We append the value to the value database.
      await valueDb.openDb.add(value);
      console.log(`New value appended to the key ${key}`);
    });
  }

  public async get(key: string): Promise<string[]> {
    const values = await this.mutex.runExclusive(async () => {
      if (!this.keys.has(key)) {
        throw new Error(`Key ${key} does not exist`);
      }
      const valueDb = await this.getValueDb(key, true);

      // We get all the values from the value database.
      const values = await valueDb.getAll();
      return values;
    });
    return values;
  }

  public async getAllKeys(): Promise<string[]> {
    const keys = await this.mutex.runExclusive(async () => {
      return Array.from(this.keys);
    });
    return keys;
  }

  private async newKeyAdded(key: string): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.keys.add(key);
      // If we are a collaborator, replicate the key by keeping the valueDb open.
      if (this.isCollaborator) {
        // TODO: Find a better protocol to name the valueDb, current protocol:
        // "<keyDbName>::<ValueDbName>"
        const valueDbName = `${this.dbName}::${key}`;
        const valueDb = new Database(valueDbName, this.orbitdb, this.events);
        // Init new becuase we do not need to sync the database now.
        // TODO: See if we need to sync it.
        await valueDb.initNew();
        this.keyDbs.set(key, valueDb);
        console.log(`Key ${key} replicated`);
      }
    });
  }

  private async getValueDb(key: string, existing: boolean): Promise<Database> {
    let valueDb: Database;
    if (this.keyDbs.has(key)) {
      // If we are replicating the key, we use the existing value database.
      valueDb = this.keyDbs.get(key);
    } else {
      // If we are not replicating the key, we open the value database.
      // TODO: Find a better protocol to name the valueDb, current protocol:
      // "<keyDbName>::<ValueDbName>"
      const valueDbName = `${this.dbName}::${key}`;
      valueDb = new Database(valueDbName, this.orbitdb, this.events);
      if (existing) {
        // If the database already exists, we open it and sync it.
        await valueDb.initExisting();
      } else {
        await valueDb.initNew();
      }

      // TODO: The new database needs to stay accessible for the collaborators to replicate it.
      //       Every change is made without confirmation that it was replicated to the collaborators.
      //       To mitigate this we replicate permanently the keyDb. Asuming non collaborators are
      //       temporary nodes, and could not stay too long in the network. See if this is the best
      //       approach.
      this.keyDbs.set(key, valueDb);
    }
    return valueDb;
  }
}
