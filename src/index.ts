/**
 * @module AstraDb
 * @description Provides an interface for users to interact with AstraDb.
 */
import { AstraDbNode } from "./astradb.js";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";
import { MemoryBlockstore } from "blockstore-core";
import { MemoryDatastore } from "datastore-core";
import EventEmitter from "events";

/**
 * Options used to create an AstraDb.
 */
export interface AstraDbInit {
  /**
   * dbName is the identifier of the database which the node connects to.
   */
  dbName?: string;

  /**
   * A collaborator is a node which helps with the availability and persistence of the database.
   * This means that the collaborator will replicate all the db's data, using its own local storage.
   * Web browsers are not good candidates for collaborators, since they are not always online.
   * Only collaborator nodes can create a new db. If a node is not a collaborator, it can only connect to an existing astradb.
   * By default the node is not a collaborator.
   */
  isCollaborator?: boolean;

  /**
   * The login key in base32 format.
   *
   * This is the key used to connect and authenticate the user.
   *
   * If no key is provided, the node will create a new key that can be retrieved using the `getLoginPrivateKey` method.
   */
  loginKey?: string;

  /**
   * The datastore used by the node.
   * By default the node will use a MemoryDatastore, which is a memory-based datastore.
   * If you want to use a persistent datastore, you can pass a different datastore.
   * For browser environments, you can use the LevelDatastore.
   * For node environments, you can use the FsDatastore.
   *
   * A collaborator node should use a persistent datastore, since it will replicate the db's data.
   * It will fail to start if the datastore is not persistent.
   */
  datastore?: Datastore;

  /**
   * The blockstore used by the node.
   * By default the node will use a MemoryBlockstore, which is a memory-based blockstore.
   * If you want to use a persistent blockstore, you can pass a different blockstore.
   * For browser environments, you can use the LevelBlockstore.
   * For node environments, you can use the FsBlockstore.
   *
   * A collaborator node should use a persistent blockstore, since it will replicate the db's data.
   * It will fail to start if the blockstore is not persistent.
   */
  blockstore?: Blockstore;

  /**
   * The public ip of the node. If the node is running in a browser, this will be ignored.
   */
  publicIp?: string;

  /**
   * The tcp port of the node. If astradb is running in a browser, this will be ignored.
   * @default 40001
   */
  TcpPort?: number;

  /**
   * The websocket port of the node. If astradb is running in a browser, this will be ignored.
   * @default 40002
   */
  WSPort?: number;

  /**
   * The websocket secure port of the node. If astradb is running in a browser, this will be ignored.
   * @default 40003
   */
  WSSPort?: number;

  /**
   * Data directory. This is the directory where all the astradb data will be stored,
   * it is recommended to use the same directory as the datastore and blockstore.
   *
   * Different nodes should use different directories.
   *
   * @default "./data"
   *
   * @example
   * ```typescript
   * const datastore = new FsDatastore("./data/node1/datastore");
   * const blockstore = new FsBlockstore("./data/node1/blockstore");
   * const astraDb = await createAstraDb({
   *  dbName: "mydb",
   *  datastore: datastore,
   *  blockstore: blockstore,
   *  dataDir: "./data/node1",
   * });
   */
  dataDir?: string;

  /**
   * If true, the node will not connect to the network and will not provide the database.
   * Also will not wait for a database to sync if it is not a collaborator.
   * This is useful for testing purposes.
   *
   * @default false
   */
  offlineMode?: boolean;
}

/**
 * Creates an instance of AstraDb.
 *
 * @function createAstraDb
 * @param {AstraDbInit} initOptions Options used to create an AstraDb
 * @instance
 */
export async function createAstraDb(
  initOptions: AstraDbInit = {}
): Promise<AstraDbNode> {
  if (!initOptions.dbName) {
    throw new Error("dbName is required");
  }
  if (initOptions.isCollaborator) {
    if (!initOptions.datastore || !initOptions.blockstore) {
      throw new Error(
        "A collaborator node must use a persistent datastore and blockstore."
      );
    }
  }
  initOptions.isCollaborator = initOptions.isCollaborator ?? false;
  initOptions.loginKey = initOptions.loginKey ?? "";
  initOptions.datastore = initOptions.datastore ?? new MemoryDatastore();
  initOptions.blockstore = initOptions.blockstore ?? new MemoryBlockstore();
  initOptions.publicIp = initOptions.publicIp ?? "0.0.0.0";
  initOptions.TcpPort = initOptions.TcpPort ?? 40001;
  initOptions.WSPort = initOptions.WSPort ?? 40002;
  initOptions.WSSPort = initOptions.WSSPort ?? 40003;
  initOptions.dataDir = initOptions.dataDir ?? `./data`;
  initOptions.offlineMode = initOptions.offlineMode ?? false;

  const node = new AstraDbNode(initOptions.dbName);
  await node.init(initOptions);
  return node;
}

/**
 * The API presented by an AstraDb.
 */
export interface AstraDb {
  /**
   * Appends a new value to the key in the AstraDb.
   *
   * If the key does not exist, it will be created.
   *
   * If the key exists, the new value will be appended to the existing value.
   */
  add: (key: string, value: string) => Promise<void>;

  /**
   * Retrieves all the value associated with a key in the AstraDb.
   */
  get: (key: string) => Promise<string[]>;

  /**
   * Retrieves all keys in the AstraDb.
   */
  getAllKeys: () => Promise<string[]>;

  /**
   * Retrieves the public login key used to connect to the user in AstraDb.
   *
   * This key idenifies the user.
   *
   * It is returned as a base32 encoded string.
   */
  getLoginPublicKey: () => string;

  /**
   * Retrieves the private login key used to connect to the user in AstraDb.
   *
   * This key is used to authenticate the user, so it is important to keep it secret.
   *
   * It can be used when creating a new AstraDb instance to connect to the same user.
   *
   * It is returned as a base32 encoded string.
   */
  getLoginPrivateKey: () => Promise<string>;

  /**
   * Events emitted by the AstraDb.
   *
   * It can be used to listen for key append events.
   *
   * Events are emitted only for keys that were fetched from the database.
   *
   * To listen for events, you can use the `on` method of the EventEmitter.
   *
   * The event name is in the format `{dbname}::{key}`.
   *
   * @example
   * ```typescript
   * const astraDb = await createAstraDb({ dbName: "mydb" });
   * const values = await astraDb.get("exampleKey");
   * astraDb.events.on("mydb::exampleKey", async (value) => {
   *  console.log(`New value for exampleKey: ${value}`);
   * });
   *
   *
   */
  events: EventEmitter;
}
