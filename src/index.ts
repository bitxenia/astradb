/**
 * @module AstraDb
 * @description Provides an interface for users to interact with AstraDb.
 */
import { AstraDbNode } from "./astradb.js";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";
import { MemoryBlockstore } from "blockstore-core";
import { MemoryDatastore } from "datastore-core";

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
   * The public ip of the node
   */
  publicIP?: string;
}

/**
 * Creates an instance of AstraDb.
 *
 * @function createAstraDb
 * @param {AstraDbInit} init Options used to create an AstraDb
 * @instance
 */
export async function createAstraDb(
  init: AstraDbInit = {}
): Promise<AstraDbNode> {
  if (!init.dbName) {
    throw new Error("dbName is required");
  }
  const isCollaborator = init.isCollaborator ?? false;
  const datastore = init.datastore ?? new MemoryDatastore();
  const blockstore = init.blockstore ?? new MemoryBlockstore();
  const publicIP = init.publicIP ?? "0.0.0.0";

  const node = new AstraDbNode(init.dbName);
  await node.init(isCollaborator, datastore, blockstore, publicIP);
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
}
