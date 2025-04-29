import { OrbitDB } from "@orbitdb/core";
import { Database, SyncTimeoutError } from "./database.js";

export class KeyRepository {
  dbName: string;
  orbitdb: OrbitDB;
  isCollaborator: boolean;
  keyDb: Database;
  keys: Set<string>;
  keyDbs: Map<string, Database>;

  constructor(dbName: string, orbitdb: OrbitDB, isCollaborator: boolean) {
    this.dbName = dbName;
    this.orbitdb = orbitdb;
    this.isCollaborator = isCollaborator;
    this.keys = new Set<string>();
    this.keyDbs = new Map<string, Database>();
  }

  public async init(): Promise<void> {
    this.keyDb = new Database(this.orbitdb);

    if (!this.isCollaborator) {
      // If we are not a collaborator, we open an existing database which sincronizes with the providers.
      try {
        await this.keyDb.openDatabase(this.dbName);
      } catch (error) {
        if (error instanceof SyncTimeoutError) {
          // If we are not a collaborator and the db did not sync with the providers,
          // We throw an error because a non collaborator node cannot create a new astradb.
          throw Error(`No providers found for the key repository database`);
        } else {
          throw error;
        }
      }
    } else {
      // If we are a collaborator, we create a new database,
      // because it is not necessary to sync with the providers immediately.
      await this.keyDb.createDatabase(this.dbName);
    }

    // We update the repository with the keys that are already in the database.
    await this.updateRepository();

    // Then we start the services.
    this.startService(async () => {
      await this.updateRepository();
    });

    await this.setupDbEvents();
  }

  public async add(key: string, value: string): Promise<void> {
    if (!this.keys.has(key)) {
      // If the key does not exist, we add it to the keys set and to the database.
      this.keys.add(key);
      await this.keyDb.openDb.add(key);
      console.log(`Key ${key} added to the key repository`);
    }
    const valueDb = await this.getValueDb(key, false);

    // We append the value to the value database.
    await valueDb.openDb.add(value);
    console.log(`Value ${value} appended to the key ${key}`);
  }

  public async get(key: string): Promise<string[]> {
    if (!this.keys.has(key)) {
      throw new Error(`Key ${key} does not exist`);
    }
    const valueDb = await this.getValueDb(key, true);

    // We get the value from the value database.
    return await valueDb.openDb.all();
  }

  public async getAllKeys(): Promise<string[]> {
    return Array.from(this.keys);
  }

  private async getValueDb(key: string, existing: boolean): Promise<Database> {
    let valueDb: Database;
    if (this.keyDbs.has(key)) {
      // If we are replicating the key, we use the existing value database.
      valueDb = this.keyDbs.get(key);
    } else {
      // If we are not replicating the key, we open the value database.
      valueDb = new Database(this.orbitdb);
      // TODO: Find a better protocol to name the valueDb, current protocol:
      // "<keyDbName>::<ValueDbName>"
      const valueDbName = `${this.dbName}::${key}`;
      if (existing) {
        // If the database already exists, we open it and sync it.
        await valueDb.openDatabase(valueDbName);
      } else {
        await valueDb.createDatabase(valueDbName);
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

  private async setupDbEvents() {
    this.keyDb.openDb.events.on("update", async (entry) => {
      await this.newKeyAdded(entry.payload.value);
    });

    this.keyDb.openDb.events.on("join", async (peerId, heads) => {
      console.log(`${peerId} joined the key database`);
    });
  }

  private async updateRepository(): Promise<void> {
    // Because of orbitdb eventual consistency nature, we need to check if new keys were added
    // when we sync with other peers. This is because not all the entry sync updates trigger the
    // "update" event. Only the latest entry is triggered.
    for await (const record of this.keyDb.openDb.iterator()) {
      let keyName = record.value;
      // If we already have the key, skip it
      if (this.keys.has(keyName)) {
        continue;
      }
      await this.newKeyAdded(keyName);
    }
  }

  private async newKeyAdded(keyName: string): Promise<void> {
    console.log(`New key added: ${keyName}`);
    this.keys.add(keyName);
    // If we are a collaborator, replicate the key by keeping the valueDb open.
    if (this.isCollaborator) {
      const valueDb = new Database(this.orbitdb);
      // Init new becuase we do not need to sync the database now.
      // TODO: See if we need to sync it.
      await valueDb.createDatabase(keyName);
      this.keyDbs.set(keyName, valueDb);
      console.log(`Key ${keyName} replicated`);
    }
  }

  private async startService(serviceFunction: () => Promise<void>) {
    // TODO: Find a better way to handle the service function. it should be stoppable.
    while (true) {
      try {
        await serviceFunction();
      } catch (error) {
        console.error("Error in service function:", error);
      }
      // Wait 10 seconds before running the service function again
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
