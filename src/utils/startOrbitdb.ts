import { createHelia } from "helia";
import { createOrbitDB, KeyStore, Identities } from "@orbitdb/core";
import { CreateLibp2pOptions } from "./libp2pOptions.js";
import { CreateLibp2pOptionsBrowser } from "./libp2pOptionsBrowser.js";
import { createLibp2p } from "libp2p";
import { loadOrCreateSelfKey } from "@libp2p/config";
import { type OrbitDB } from "@orbitdb/core";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { privateKeyFromRaw } from "@libp2p/crypto/keys";

const USER_ID = "user-id";

export const startOrbitDb = async (
  loginKey: string,
  datastore: Datastore,
  blockstore: Blockstore,
  publicIP: string,
  TcpPort: number,
  WebRTCDirectPort: number,
  dataDir: string
) => {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    console.log("Browser enviroment detected");
  } else {
    console.log("Node enviroment detected");
  }
  const privateKey = await loadOrCreateSelfKey(datastore);

  let libp2pOptions: Object;
  if (isBrowser) {
    libp2pOptions = CreateLibp2pOptionsBrowser();
  } else {
    libp2pOptions = CreateLibp2pOptions(publicIP, TcpPort, WebRTCDirectPort);
  }

  const libp2p = await createLibp2p({
    datastore,
    privateKey,
    ...libp2pOptions,
  });

  libp2p.addEventListener("certificate:provision", () => {
    console.info("A TLS certificate was provisioned");
  });

  const helia = await createHelia({
    datastore,
    blockstore,
    libp2p,
  });
  console.log(`Node started with id: ${helia.libp2p.peerId.toString()}`);

  const identities = await CreateIdentities(loginKey, helia, dataDir);

  const orbitdb = await createOrbitDB({
    ipfs: helia,
    directory: dataDir,
    identities: identities,
    id: USER_ID,
  });

  console.log("Peer multiaddrs:");
  let multiaddrs = orbitdb.ipfs.libp2p.getMultiaddrs();
  for (const ma of multiaddrs) {
    console.log(`${ma}`);
  }

  // Log the peer's multiaddrs whenever they change
  let oldAddrs = [];
  orbitdb.ipfs.libp2p.addEventListener("self:peer:update", (evt) => {
    const newAddrs = orbitdb.ipfs.libp2p.getMultiaddrs();
    if (JSON.stringify(oldAddrs) !== JSON.stringify(newAddrs)) {
      console.log("Peer multiaddrs changed:");
      for (const ma of newAddrs) {
        console.log(`${ma}`);
      }
      oldAddrs = newAddrs;
    }
  });

  return orbitdb;
};

/**
 * Stops the OrbitDB peer and associated services.
 * @function stopOrbitDB
 * @param {OrbitDB} orbitdb The OrbitDB instance to stop.
 */
export const stopOrbitDB = async (orbitdb: OrbitDB) => {
  await orbitdb.stop();
  await orbitdb.ipfs.stop();
  await orbitdb.ipfs.blockstore.unwrap().unwrap().child.db.close();
};

export async function getPrivateKey(orbitdb: OrbitDB): Promise<string> {
  const keystore = orbitdb.keystore;
  const keyObj = await keystore.getKey(USER_ID);
  const rawPrivateKey = keyObj.raw;
  const hexPrivateKey = uint8ArrayToString(rawPrivateKey, "base32");
  return hexPrivateKey;
}

export function getPublicKey(orbitdb: OrbitDB): string {
  return orbitdb.identity.publicKey;
}

async function CreateIdentities(
  loginKey: string,
  ipfs: any,
  dataDir: string
): Promise<any> {
  const keystore = await KeyStore({ path: `${dataDir}/keystore` });

  if (!loginKey) {
    console.log("No login key provided, creating new identity");
    await keystore.createKey(USER_ID);
  } else {
    console.log("Login key provided, using existing identity");
    const restoredRaw = uint8ArrayFromString(loginKey, "base32");
    const privateKey = privateKeyFromRaw(restoredRaw);
    await keystore.addKey(USER_ID, { privateKey: privateKey.raw });
  }

  // Add logic to create and return an identity here
  return await Identities({ ipfs, keystore });
}
