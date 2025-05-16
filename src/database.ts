import {
  type OrbitDB,
  ComposedStorage,
  IPFSAccessController,
  IPFSBlockStorage,
  LRUStorage,
} from "@orbitdb/core";
import EventEmitter from "events";

export class SyncTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncTimeoutError";
  }
}

export class Database {
  dbName: string;
  orbitdb: OrbitDB;
  openDb: any;
  entriesSeen: Set<string>;
  events: EventEmitter;
  onUpdate?: (value: string) => Promise<void>;

  constructor(
    dbName: string,
    orbitdb: OrbitDB,
    events: EventEmitter,
    onUpdate?: (value: string) => Promise<void>
  ) {
    this.dbName = dbName;
    this.orbitdb = orbitdb;
    this.entriesSeen = new Set<string>();
    this.events = events;
    this.onUpdate = onUpdate;
  }

  public async initNew(): Promise<void> {
    await this.createDatabase();
    await this.setupDbEvents();
    await this.updateDatabase();
  }

  public async initExisting(msTimeout: number): Promise<boolean> {
    await this.createDatabase();
    const synced = await this.syncDb(msTimeout);
    await this.setupDbEvents();
    await this.updateDatabase();
    return synced;
  }

  public async add(value: string): Promise<void> {
    // We add the value to the database.
    const hash = await this.openDb.add(value);
    await this.newEntryAdded(hash, value);
  }

  public async getAll(): Promise<string[]> {
    // We get all the values from the database.
    const values = await this.openDb.all();
    return values.map((entry: any) => entry.value);
  }

  private async createDatabase() {
    // We use the default storage, found in:
    // https://github.com/orbitdb/orbitdb/blob/d290032ebf1692feee1985853b2c54d376bbfc82/src/access-controllers/ipfs.js#L56
    const storage = await ComposedStorage(
      await LRUStorage({ size: 1000 }),
      await IPFSBlockStorage({ ipfs: this.orbitdb.ipfs, pin: true })
    );

    // We use the IPFSAccessController to allow all peers to write to the database.
    const db = await this.orbitdb.open(this.dbName, {
      AccessController: IPFSAccessController({
        write: ["*"],
        storage,
      }),
    });
    this.openDb = db;
  }

  private async syncDb(msTimeout: number): Promise<boolean> {
    // We wait for the database to be synced with at least one provider.
    // This is because the database is empty until it is synced.
    let synced = false;
    const onJoin = async (peerId: any, heads: any) => {
      console.log(`Database ${this.openDb.address} synced with peer ${peerId}`);
      synced = true;
    };
    // We use the join event to know when an exchange of heads (sync) happened between peers.
    // https://api.orbitdb.org/module-Sync-Sync.html#event:join
    this.openDb.events.on("join", onJoin);

    // TODO: Maybe there is a race condition here, we should check if the event already fired.
    // Check if the database is already synced by looking at the entries could not work because
    // the database could not be empty locally and not synced with the providers.

    try {
      await this.waitFor(
        async () => synced,
        async () => true,
        100,
        msTimeout
      );
    } catch (error) {
      if (error instanceof SyncTimeoutError) {
        console.log(
          "Warning: Timeout received. Database was not synced with any provider. Asuming it is a new database with no providers."
        );
        return false;
      } else {
        throw error;
      }
    }
    return true;
  }

  private async waitFor(
    valueA: any,
    toBeValueB: any,
    pollInterval: number,
    timeout: number
  ): Promise<void> {
    // TODO: We use this slight modifided busy wait found in the OrbitDB codebase:
    // https://github.com/orbitdb/orbitdb/blob/main/test/utils/wait-for.js
    // They use it to wait for the database to be synced.
    // We should find a better way to do this, not using a busy wait.

    return new Promise<void>((resolve, reject) => {
      let elapsedTime = 0;

      const interval = setInterval(async () => {
        if ((await valueA()) === (await toBeValueB())) {
          clearInterval(interval);
          resolve();
        }
        elapsedTime += pollInterval;

        if (elapsedTime >= timeout) {
          clearInterval(interval);
          reject(new SyncTimeoutError("Timeout waiting for condition"));
        }
      }, pollInterval);
    });
  }

  private async setupDbEvents() {
    this.openDb.events.on("update", async (entry) => {
      // We update the database when a new entry is added.
      await this.updateDatabase();
    });

    this.openDb.events.on("join", async (peerId, heads) => {
      console.log(`${peerId} joined the database ${this.dbName}`);
    });
  }

  private async updateDatabase(): Promise<void> {
    // Because of orbitdb eventual consistency nature, we need to check if new keys were added
    // when we sync with other peers. This is because not all the entry sync updates trigger the
    // "update" event. Only the latest entry is triggered.
    for await (const record of this.openDb.iterator()) {
      const hash = record.hash;
      // If we already have the entry, skip it
      if (this.entriesSeen.has(hash)) {
        continue;
      }
      await this.newEntryAdded(hash, record.value);
    }
  }

  private async newEntryAdded(hash: string, value: string): Promise<void> {
    this.entriesSeen.add(hash);
    // We call the onUpdate callback function with the new value.
    if (this.onUpdate) {
      this.onUpdate(value);
    }

    // We emit the new entry added event.
    this.events.emit(`${this.dbName}`, value);
    console.log(`New entry added to the database ${this.dbName}`);
  }
}
