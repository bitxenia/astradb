# AstraDB

**AstraDB** is a distributed database infrastructure designed to power **dynamic, community-driven, and decentralized applications**.
Built as a higher-level layer over [OrbitDB](https://github.com/orbitdb/orbitdb) and [LibP2P](https://github.com/libp2p/js-libp2p), it provides the core mechanisms for **data synchronization**, **replication**, and **collaboration** between nodes in a peer-to-peer environment.

Unlike traditional databases, AstraDB is specifically designed for **mutable-state applications** operating on top of [IPFS](https://ipfs.tech), such as knowledge repositories or real-time messaging systems.
It automates the fundamental tasks required for decentralized operation — including **node discovery**, **eventual consistency**, and **data persistence** — allowing developers to build responsive and fault-tolerant systems without centralized servers.

Each AstraDB instance behaves as a fully independent, self-replicating node that can interconnect with others to share data.
Its **key–value event model** allows every entity (for example, an article or a chat) to evolve as a chronological sequence of updates, making it possible to reconstruct or audit any state at any point in time.

This approach makes AstraDB ideal for applications that rely on **real-time collaboration** and **community ownership**, where users contribute directly to data availability and integrity.

## Applications

AstraDB serves as the data layer for Bitxenia’s decentralized applications:

- **[Astrawiki](https://github.com/bitxenia/astrawiki)** — a collaborative knowledge repository that allows users to create and edit articles distributed across the IPFS network.
- **[Astrachat](https://github.com/bitxenia/astrachat)** — a real-time messenger where all messages are stored and synchronized through AstraDB using event-based updates.

Both applications demonstrate how AstraDB abstracts away the complexity of peer-to-peer networks, enabling developers to focus on the logic of their decentralized systems.

## Overview

- Built on **IPFS**, **OrbitDB**, and **LibP2P**
- Event-based **key–value data model**
- Supports **append-only** structures and **real-time updates**
- Provides **node discovery** and **collaborator replication**
- Fully decentralized — no central servers or authorities
- Designed for **distributed, community-oriented applications**

## Install

```sh
npm install @bitxenia/astradb
```

## Usage

Using the `createAstradb` init function you can create and connect the node to a database.


```ts
import { createAstradb } from "@bitxenia/astradb";

const node = await createAstradb({
  dbName: "bitxenia-db",
});

const keyList = await node.getAllKeys();
console.log(keyList);
```

### Add a Key and Value

You can add a new value under a specific key.  
Each addition is stored as a new event in the key’s history.


```ts
await node.add("article:001", "First version of the article");
console.log("Value added successfully");
```

### Get Values from a Key

Retrieve all stored values for a specific key.  
Each value represents an event in the order it was added.

```ts
const values = await node.get("article:001");
console.log(values);
// → ["First version of the article"]
```

### Listen for Real-Time Updates

AstraDB emits events whenever a new value is added to a key that was previously fetched.  
The event name follows the format `{dbname}::{key}`.

```ts
const astraDb = await createAstradb({ dbName: "mydb" });
const values = await astraDb.get("exampleKey");

astraDb.events.on("mydb::exampleKey", async (value) => {
  console.log(`New value for exampleKey: ${value}`);
});
```

## Documentation

You can find more advanced topics, such as a detailed explanation of AstraDB’s architecture and internal components, in our [docs](https://github.com/bitxenia/docs/tree/main/ipfs/application).

## Development

**Clone and install dependencies:**

```sh
git clone git@github.com:bitxenia/astradb.git
cd astradb
npm install
```

### Run Tests

```sh
npm run test
```

### Build

```sh
npm run build
```

## Contribute

Contributions welcome! Please check out the issues.

## Troubleshooting

### The node cannot receive incoming connections and, as a result, cannot collaborate.

If the node is set to collaborate and it fails to do so, the reason should most likely be a port issue. The `LibP2P` implementation uses `UPnP` to automatically open ports and detect the public IP. If the modem is outdated, you will need to manually open the ports and specify the public IP when creating the node in the `createAstradb` init function.

The default ports that need to be opened manually, if not changed on the options, are:

- `40001` TCP port, used to receive `TCP` incoming connections.
- `40001` UDP port, used to receive `WebRTC-Direct` incoming connections.

If this does not work, your ISP may be using Double NAT, which prevents incoming connections. In this case, you may need to contact your ISP to request a solution.

## License

MIT (LICENSE-MIT / http://opensource.org/licenses/MIT)

