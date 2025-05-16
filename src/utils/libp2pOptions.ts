import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { createDelegatedRoutingV1HttpApiClient } from "@helia/delegated-routing-v1-http-api-client";
import { delegatedHTTPRoutingDefaults } from "@helia/routers";
import { bootstrap } from "@libp2p/bootstrap";
import { identify, identifyPush } from "@libp2p/identify";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { ping } from "@libp2p/ping";
import { tcp } from "@libp2p/tcp";
import { webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { keychain } from "@libp2p/keychain";

export function CreateLibp2pOptions(
  publicIP: string,
  TcpPort: number,
  WebRTCDirectPort: number
) {
  let appendAnnounce: string[] = [];
  // If a public ip was provided, use append announce
  if (publicIP != "0.0.0.0") {
    appendAnnounce = [
      `/ip4/${publicIP}/tcp/${TcpPort}`,
      `/ip4/${publicIP}/udp/${WebRTCDirectPort}/webrtc-direct`,
    ];
  }
  return {
    // TODO: Ports were manually opened, in my case upnp did not work.
    // Websocket ports need to differ from the tcp ports
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${TcpPort}`,
        `/ip4/0.0.0.0/udp/${WebRTCDirectPort}/webrtc-direct`,
      ],
      // Two websocket adresses are added for auto-tls to work.
      // Per: https://github.com/libp2p/js-libp2p/issues/2929
      // TODO: Append announce is only needed if upnp does not work. And ports are manually opened.
      appendAnnounce: appendAnnounce,
    },
    transports: [tcp(), webRTCDirect(), webSockets()],
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
        // Server mode makes the node unable to receive connections, I think it is becuase it is always full.
        // We do not need server mode anyway.
        clientMode: true,
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      ping: ping(),
      keychain: keychain(),
    },
  };
}
