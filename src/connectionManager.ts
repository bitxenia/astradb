import { HeliaLibp2p } from "helia";
import { CID } from "multiformats/cid";
import { Peer, PeerId } from "@libp2p/interface";
import { UnixFS, unixfs } from "@helia/unixfs";
import { type Multiaddr, multiaddr } from "@multiformats/multiaddr";

interface Provider {
  id: PeerId;
  multiaddrs: Multiaddr[];
}

export class ConnectionManager {
  private dbName: string;
  private ipfs: HeliaLibp2p;
  private providerCID: CID;
  private fs: UnixFS;
  private protocol: string;
  private providerProtocol: string;
  private connectedProviders: Set<Provider>;

  constructor(dbName: string, ipfs: HeliaLibp2p) {
    this.dbName = dbName;
    this.ipfs = ipfs;
    this.protocol = `/astradb/${this.dbName}`;
    this.providerProtocol = `/astradb/${this.dbName}/provider`;
    this.connectedProviders = new Set<Provider>();
  }

  public async init(isCollaborator: boolean, bootstrapProviderPeers: string[]) {
    this.providerCID = await this.constructProviderCID(
      this.dbName,
      isCollaborator
    );

    // Add astradb protocol to the libp2p node.
    await this.ipfs.libp2p.handle(this.protocol, ({ stream }) => {
      console.log(`Received connection from /astradb/${this.dbName} peer`);
    });

    // Add provider protocol to the libp2p node if we are a collaborator.
    // We use this protocol to identify the provider peers.
    if (isCollaborator) {
      await this.ipfs.libp2p.handle(this.providerProtocol, ({ stream }) => {
        console.log(
          `Received connection from /astradb/${this.dbName}/provider peer`
        );
      });
    }

    this.startService(async () => {
      await this.searchForProviders();
    });

    // We only want to provide the database if we are a collaborator.
    if (isCollaborator) {
      // We do not await to the provide to finish.
      this.startService(async () => {
        await this.provideDB(this.providerCID);
      });
    }

    // TODO: searchForProviders & provideDB cause provider connection drops for some reason.
    //       It seems that it is trying to connect again to the same provider, causing to drop the connection.
    //       And it seems to happen with dht interactions. So that's why these two functions could be causing the issue.
    //       That's why we are reconnecting to previously connected providers. See if we can improve this.
    this.startService(async () => {
      await this.reconnectToProviders();
    }, 5000);

    this.setupEvents();

    // We try to connect to the bootstrap provider peers.
    for (const bootstrapPeer of bootstrapProviderPeers) {
      const addr = multiaddr(bootstrapPeer);
      this.ipfs.libp2p.dial(addr).then(
        (conn) => {
          console.log(`Connected to bootstrap provider peer ${addr}`);
        },
        (error) => {
          console.error(
            `Error connecting to bootstrap provider peer ${addr}: ${error}`
          );
        }
      );
    }
  }

  private async constructProviderCID(
    dbName: string,
    isCollaborator: boolean
  ): Promise<CID> {
    // This is the CID used to identify the database.
    // We upload it to ipfs and provide it (if we are a collaborator) so other peers can find us.

    // TODO: We are adding this file to prevent getting banned from the network. See if this is needed.

    // create a filesystem on top of Helia, in this case it's UnixFS
    this.fs = unixfs(this.ipfs);

    // we will use this TextEncoder to turn strings into Uint8Arrays
    const encoder = new TextEncoder();

    // add the bytes to your node and receive a CID
    const cid = await this.fs.addBytes(encoder.encode(dbName));

    if (isCollaborator) {
      // Check if the CID is already pinned. If not, pin it.
      if (!(await this.ipfs.pins.isPinned(cid))) {
        // Pin the block
        for await (const pinnedCid of this.ipfs.pins.add(cid)) {
          console.log(`Pinned CID: ${pinnedCid}`);
        }
      }
    } else {
      // If we are not a collaborator, we do run the gc to remove the block from the local datastore.
      // This is because since we are not a collaborator, we don't need to keep the block in our local datastore.
      await this.ipfs.gc();
    }

    console.log(`Provider CID created: ${cid}`);
    return cid;
  }

  private async provideDB(cid: CID): Promise<void> {
    // TODO: Right now we are providing the CID every 60 seconds. See if this is really needed.
    //       Because Helia will supposedly automatically re-provide.
    /**
     * Helia will periodically re-provide every previously provided CID.
     * https://github.com/ipfs/helia/blob/bb2ab74e711ae67514397aa982e35031bdf6541f/packages/interface/src/routing.ts#L67
     */
    let provided = false;
    console.log("Providing CID address...");
    while (!provided) {
      try {
        const startTime = performance.now();
        await this.ipfs.routing.provide(cid);
        const endTime = performance.now();
        provided = true;

        console.log(
          `CID ${cid} provided, took ${(endTime - startTime) / 1000} seconds`
        );
      } catch (error) {
        console.error("Error providing CID:", error);
        console.log("Retrying provide...");
      }
    }
  }

  private async searchForProviders(): Promise<void> {
    // TODO: Check if we need to add a timeout.
    try {
      let providers = this.ipfs.libp2p.contentRouting.findProviders(
        this.providerCID
      );
      for await (const provider of providers) {
        const providerInfo: Provider = {
          id: provider.id,
          multiaddrs: provider.multiaddrs,
        };
        await this.connectToProvider(providerInfo);
      }
    } catch (error) {
      console.error("Error finding providers:", error);
    }
  }

  private async reconnectToProviders(): Promise<void> {
    for (const provider of this.connectedProviders) {
      await this.connectToProvider(provider);
    }
  }

  private async connectToProvider(provider: Provider): Promise<void> {
    try {
      // Check if the provider is us.
      if (provider.id.equals(this.ipfs.libp2p.peerId)) {
        // console.log("Provider is us, skipping...");
        return;
      }
      // Check if we are already connected.
      if (this.ipfs.libp2p.getConnections(provider.id).length > 0) {
        // console.log(`Already connected to provider: ${provider.id}`);
        return;
      }

      console.log(`Connecting to provider: ${provider.id}`);

      const multiaddrs = provider.multiaddrs.map((ma) => multiaddr(ma));
      this.ipfs.libp2p.dial(multiaddrs).then(
        (conn) => {
          console.log(`Connected to provider ${provider.id}`);
        },
        (error) => {
          console.error(
            `Error connecting to provider ${provider.id}: ${error}`
          );
        }
      );
    } catch (error) {
      console.error(`Error connecting to provider ${provider.id}: ${error}`);
    }
  }

  private setupEvents() {
    this.ipfs.libp2p.addEventListener("peer:connect", (evt) => {
      const peerId = evt.detail;
      this.manageNewConnection(peerId);
    });
  }

  private async manageNewConnection(peerId: PeerId) {
    let peerInfo: Peer;
    let peerInfoFound = false;
    let retryCount = 0;
    while (!peerInfoFound) {
      if (!(await this.ipfs.libp2p.peerStore.has(peerId))) {
        // If the peer info is not found, retry a few times.
        // This is because the peer info is not available yet.
        if (retryCount > 10) {
          console.log(
            "Warning: New connection peer info not found, skipping peer. Triggered by: ",
            peerId
          );
          return;
        }
        retryCount++;
        // Wait for the peer info to be available.
        // TODO: Find a better way to do this.
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      peerInfo = await this.ipfs.libp2p.peerStore.get(peerId);
      peerInfoFound = true;
    }

    // See if the peer is not an Astradb peer.
    if (!peerInfo.protocols.includes(this.protocol)) {
      return;
    }
    console.log(
      `New connection from a /astradb/${this.dbName} peer: ${peerId}`
    );

    // See if the peer is a provider peer.
    if (peerInfo.protocols.includes(this.providerProtocol)) {
      console.log(`New connection is from a provider peer: ${peerId}`);
      // Add the peer to the connected providers.
      this.connectedProviders.add({
        id: peerId,
        multiaddrs: peerInfo.addresses.map((ma) => ma.multiaddr),
      });
    }

    // Tag the peer with a high priority to make sure we are connected to it.
    // https://github.com/libp2p/js-libp2p/blob/main/doc/LIMITS.md#closing-connections
    await this.ipfs.libp2p.peerStore.merge(peerId, {
      tags: {
        "astradb-peer": {
          value: 100, // 0-100 is the typical value range
        },
      },
    });
  }

  private async startService(
    serviceFunction: () => Promise<void>,
    timeout: number = 60000
  ) {
    // TODO: Find a better way to handle the service function. it should be stoppable.
    while (true) {
      try {
        await serviceFunction();
      } catch (error) {
        console.error("Error in service function:", error);
      }
      // Wait 60 seconds before running the service function again
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }
}
