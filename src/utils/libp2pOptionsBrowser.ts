import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { createDelegatedRoutingV1HttpApiClient } from "@helia/delegated-routing-v1-http-api-client";
import { delegatedHTTPRoutingDefaults } from "@helia/routers";
import { bootstrap } from "@libp2p/bootstrap";
import { identify, identifyPush } from "@libp2p/identify";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { ping } from "@libp2p/ping";
import { webRTCDirect } from "@libp2p/webrtc";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";

export function CreateLibp2pOptionsBrowser() {
  return {
    transports: [webRTCDirect()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        list: [
          // We use the default list of bootstrap nodes, found in the helia repo:
          // https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.js
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
          // va1 is not in the TXT records for _dnsaddr.bootstrap.libp2p.io yet
          // so use the host name directly
          "/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8",
          "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
        ],
      }),
    ],
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
      }),
      delegatedRouting: () =>
        createDelegatedRoutingV1HttpApiClient(
          "https://delegated-ipfs.dev",
          delegatedHTTPRoutingDefaults()
        ),
      dht: kadDHT({
        // https://github.com/libp2p/js-libp2p/tree/main/packages/kad-dht#example---connecting-to-the-ipfs-amino-dht
        protocol: "/ipfs/kad/1.0.0",
        peerInfoMapper: removePrivateAddressesMapper,
        // Browser peers should only run the in client mode.
        clientMode: true,
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      ping: ping(),
    },
  };
}
