import { ethers } from "hardhat";

/**
 * Debug WETH bridge failure from Arbitrum to Sonic Hub
 */

const CONFIG = {
  // Hub on Sonic
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  
  // Gateway on Arbitrum
  arbitrumGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  
  // Tokens
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  arbitrumWETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  
  // LayerZero EIDs
  sonicEid: 30332,
  arbitrumEid: 30110,
  
  // Failed tx
  failedTx: "0x83275ef4589ed7704d539efa554de5b0f59c0927e6350be640e567a3f7f97d67",
};

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       DEBUGGING WETH BRIDGE FAILURE                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Check Hub configuration for WETH
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 1. Checking Hub Configuration for sWETH                     │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  const hubGetters = await ethers.getContractAt(
    "SyntheticTokenHubGetters",
    CONFIG.hubGetters
  );

  try {
    // Check if sWETH is registered
    const tokenIndex = await hubGetters.getTokenIndexByAddress(CONFIG.sWETH);
    console.log(`   sWETH token index: ${tokenIndex}`);

    // Get remote token info for Arbitrum
    const remoteInfo = await hubGetters.getRemoteTokenInfo(CONFIG.sWETH, CONFIG.arbitrumEid);
    console.log(`   Remote token on Arbitrum:`);
    console.log(`     Address: ${remoteInfo.remoteAddress}`);
    console.log(`     Min bridge amount: ${remoteInfo.minBridgeAmt}`);
    console.log(`     Decimals delta: ${remoteInfo.decimalsDelta}`);
    console.log(`     On pause: ${remoteInfo.onPause}`);
  } catch (e: any) {
    console.log(`   ✗ Error getting sWETH info: ${e.message?.slice(0, 100)}`);
  }

  // Check Hub peer configuration
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 2. Checking Hub LayerZero Peer Configuration                │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);

  try {
    // Check if Arbitrum gateway is set as peer
    const peer = await hub.peers(CONFIG.arbitrumEid);
    console.log(`   Arbitrum peer (EID ${CONFIG.arbitrumEid}):`);
    console.log(`     ${peer}`);
    
    // Expected peer should be the gateway address
    const expectedPeer = ethers.utils.hexZeroPad(CONFIG.arbitrumGateway.toLowerCase(), 32);
    console.log(`   Expected peer: ${expectedPeer}`);
    
    if (peer.toLowerCase() === expectedPeer.toLowerCase()) {
      console.log(`   ✓ Peer correctly configured`);
    } else {
      console.log(`   ✗ PEER MISMATCH - This could cause bridge failures!`);
    }
  } catch (e: any) {
    console.log(`   ✗ Error checking peers: ${e.message?.slice(0, 100)}`);
  }

  // Check endpoint configuration
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 3. Checking LayerZero Endpoint                              │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  try {
    const endpoint = await hub.endpoint();
    console.log(`   Hub endpoint: ${endpoint}`);
  } catch (e: any) {
    console.log(`   ✗ Error: ${e.message?.slice(0, 100)}`);
  }

  // Check sWETH token configuration
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 4. Checking sWETH Token                                     │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  try {
    const sWETH = await ethers.getContractAt("SyntheticToken", CONFIG.sWETH);
    const name = await sWETH.name();
    const symbol = await sWETH.symbol();
    const hubAddress = await sWETH.hub();
    const totalSupply = await sWETH.totalSupply();
    
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Hub: ${hubAddress}`);
    console.log(`   Total Supply: ${ethers.utils.formatEther(totalSupply)}`);
    
    if (hubAddress.toLowerCase() !== CONFIG.hub.toLowerCase()) {
      console.log(`   ✗ HUB MISMATCH - sWETH hub doesn't match SyntheticTokenHub!`);
    }
  } catch (e: any) {
    console.log(`   ✗ Error: ${e.message?.slice(0, 100)}`);
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    DEBUGGING TIPS                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n Check LayerZero scan for message status:");
  console.log(` https://layerzeroscan.com/tx/${CONFIG.failedTx}`);
  console.log("\n Common failure reasons:");
  console.log(" 1. Peer not configured correctly on Hub");
  console.log(" 2. Insufficient gas for _lzReceive execution");
  console.log(" 3. Token not properly linked on Hub");
  console.log(" 4. Min bridge amount not met");
  console.log(" 5. Token paused");
}

main();


