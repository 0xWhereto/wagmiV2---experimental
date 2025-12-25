import { ethers } from "hardhat";

/**
 * Check and retry failed LayerZero messages on the Hub
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  endpoint: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
  arbitrumEid: 30110,
  ethereumEid: 30101,
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       CHECKING FAILED MESSAGES ON HUB                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);

  // Check the Hub contract for any error reasons
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 1. Checking Hub State                                       │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  try {
    const owner = await hub.owner();
    console.log(`   Hub owner: ${owner}`);
    
    const paused = await hub.paused();
    console.log(`   Hub paused: ${paused}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message?.slice(0, 100)}`);
  }

  // Check the endpoint for failed message details
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 2. Checking Endpoint Stored Payloads                        │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  const endpointABI = [
    "function inboundPayloadHash(address _receiver, uint32 _srcEid, bytes32 _sender, uint64 _nonce) view returns (bytes32)",
    "function lazyInboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
    "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  ];

  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointABI, signer);

  // Check both Arbitrum and Ethereum sources
  for (const srcEid of [CONFIG.arbitrumEid, CONFIG.ethereumEid]) {
    const chainName = srcEid === CONFIG.arbitrumEid ? "Arbitrum" : "Ethereum";
    console.log(`\n   --- ${chainName} (EID: ${srcEid}) ---`);
    
    try {
      const peer = await hub.peers(srcEid);
      console.log(`   Peer: ${peer}`);
      
      const inboundNonce = await endpoint.inboundNonce(CONFIG.hub, srcEid, peer);
      const lazyNonce = await endpoint.lazyInboundNonce(CONFIG.hub, srcEid, peer);
      
      console.log(`   Inbound nonce: ${inboundNonce}`);
      console.log(`   Lazy nonce: ${lazyNonce}`);
      
      // Check each nonce for stored payloads
      for (let nonce = 1; nonce <= inboundNonce.toNumber(); nonce++) {
        const payloadHash = await endpoint.inboundPayloadHash(CONFIG.hub, srcEid, peer, nonce);
        if (payloadHash !== ethers.constants.HashZero) {
          console.log(`   Nonce ${nonce}: FAILED - Hash: ${payloadHash}`);
        } else {
          console.log(`   Nonce ${nonce}: ✓ Processed`);
        }
      }
    } catch (e: any) {
      console.log(`   Error: ${e.message?.slice(0, 100)}`);
    }
  }

  // Try to understand what message type is failing
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 3. Possible Failure Reasons                                 │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  console.log(`
   Common reasons for lzReceive failure:

   1. Gas limit too low - The executor didn't provide enough gas
      → Check LayerZero scan for gas used vs provided

   2. Hub reverted during processing:
      - Token not found / not linked
      - Amount too low (min bridge amount)
      - Hub is paused
      - Insufficient MIM for swap (for deposits)
      
   3. Synthetic token minting failed:
      - Hub not authorized to mint
      - Token is paused

   To retry failed messages, use LayerZero's retry mechanism
   or call the Hub's lzReceive directly with the original payload.
  `);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    NEXT STEPS                                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
   1. Check LayerZero scan: https://layerzeroscan.com
      Search for your transaction hash to see exact error

   2. If gas was insufficient, retry with more gas via:
      - LayerZero retry UI
      - Or call endpoint.retry() with more gas

   3. If Hub logic reverted, we need to fix the root cause
      then retry the message
  `);
}

main();


