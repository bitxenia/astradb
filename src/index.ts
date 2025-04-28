/**
 * @module AstraDb
 * @description Provides an interface for users to interact with AstraDb.
 */
import { AstraDbNode } from "./astradb.js";

/**
 * Options used to create an AstraDb.
 */
export interface AstraDbInit {}

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
  const node = new AstraDbNode();
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
   * Retrieves all values associated with a key in the AstraDb.
   */
  get: (key: string) => Promise<string>;
}
