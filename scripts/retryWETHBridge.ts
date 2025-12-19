import { ethers } from "hardhat";

/**
 * Check and attempt to fix the failed WETH bridge
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  endpoint: "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  arbitrumEid: 30110,
  arbitrumGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       CHECKING WETH BRIDGE STATUS                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Check sWETH configuration
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 1. sWETH Token Status                                       │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e");
  
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(CONFIG.sWETH, CONFIG.arbitrumEid);
    console.log(`   Arbitrum WETH linked: ${remoteInfo.remoteAddress}`);
    console.log(`   Min bridge amount: ${remoteInfo.minBridgeAmt} (${ethers.utils.formatEther(remoteInfo.minBridgeAmt)} ETH)`);
    console.log(`   Decimals delta: ${remoteInfo.decimalsDelta}`);
    console.log(`   Total balance: ${ethers.utils.formatEther(remoteInfo.totalBalance)} sWETH`);
    
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("\n   ⚠️ Arbitrum WETH is NOT linked to sWETH!");
    }
  } catch (e: any) {
    console.log(`   Error: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check endpoint nonces
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 2. LayerZero Message Status                                 │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  const endpointABI = [
    "function inboundPayloadHash(address,uint32,bytes32,uint64) view returns (bytes32)",
    "function lazyInboundNonce(address,uint32,bytes32) view returns (uint64)",
    "function inboundNonce(address,uint32,bytes32) view returns (uint64)",
    "function lzReceive((uint32,bytes32,uint64),bytes32,bytes,address,bytes) external payable",
  ];
  
  const endpoint = new ethers.Contract(CONFIG.endpoint, endpointABI, signer);
  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  const peer = await hub.peers(CONFIG.arbitrumEid);
  console.log(`   Arbitrum peer: ${peer}`);
  
  const inboundNonce = await endpoint.inboundNonce(CONFIG.hub, CONFIG.arbitrumEid, peer);
  const lazyNonce = await endpoint.lazyInboundNonce(CONFIG.hub, CONFIG.arbitrumEid, peer);
  
  console.log(`   Inbound nonce: ${inboundNonce}`);
  console.log(`   Lazy nonce: ${lazyNonce}`);
  
  // Check nonce 8 (the failed one)
  if (inboundNonce.toNumber() >= 8) {
    const payloadHash = await endpoint.inboundPayloadHash(CONFIG.hub, CONFIG.arbitrumEid, peer, 8);
    console.log(`   Nonce 8 payload hash: ${payloadHash}`);
    if (payloadHash !== ethers.constants.HashZero) {
      console.log("   ⚠️ Nonce 8 has a PENDING/FAILED message!");
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    DIAGNOSIS                                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
   The WETH bridge is failing because the lzReceive on the Hub is reverting.
   
   This could be due to:
   1. The message was a "Deposit" but Hub failed to process it
   2. Gas provided by LayerZero executor was insufficient
   3. Some internal Hub logic reverted
   
   To see the exact error:
   Check LayerZero scan: https://layerzeroscan.com
   
   Search for your Arbitrum tx: 0x83275ef4589ed7704d539efa554de5b0f59c0927e6350be640e567a3f7f97d67
   
   The "Message" tab will show if it was:
   - Delivered but reverted (shows error)
   - Still pending (needs more time)
   - Failed due to gas
  `);
}

main();

