import { ethers } from "hardhat";

/**
 * Link WBTC on the Hub using manualLinkRemoteToken.
 * This will allow WBTC deposits to work without redeploying the Gateway.
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  
  arbitrumEid: 30110,
  arbitrumGateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
  
  wbtcArbitrum: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  wbtcDecimals: 8, // WBTC has 8 decimals
  
  // sBTC should also have 8 decimals, so decimalsDelta = 0
  syntheticDecimals: 8,
  minBridgeAmt: ethers.utils.parseUnits("0.00001", 8), // 0.00001 BTC min
};

async function main() {
  console.log("=== LINKING WBTC ON HUB ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // Step 1: Find an unlinked sBTC
  console.log("\n--- Step 1: Finding unlinked sBTC ---");
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", CONFIG.hubGetters);
  
  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Total synthetic tokens: ${count}`);
  
  let sbtcAddress = "";
  for (let i = 1; i <= count.toNumber(); i++) {
    try {
      const info = await hubGetters.getSyntheticTokenInfo(i);
      if (info[1] === "sBTC") {
        console.log(`\nFound sBTC at index ${i}: ${info[0]}`);
        console.log(`  Symbol: ${info[1]}`);
        console.log(`  Decimals: ${info[2]}`);
        
        // Check if already linked to Arbitrum
        try {
          const remoteInfo = await hubGetters.getRemoteTokenInfo(info[0], CONFIG.arbitrumEid);
          if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
            console.log(`  → NOT linked to Arbitrum - can use this one!`);
            sbtcAddress = info[0];
            break;
          } else {
            console.log(`  → Already linked to Arbitrum: ${remoteInfo.remoteAddress}`);
          }
        } catch (e) {
          console.log(`  → Error checking remote: ${e}`);
          sbtcAddress = info[0];
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!sbtcAddress) {
    console.log("\n❌ No unlinked sBTC found. Creating one...");
    
    const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
    const tx = await hub.createSyntheticToken("BTC", 8);
    console.log(`TX: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log("✅ Created new sBTC");
    
    // Find the new token - getSyntheticTokenInfo returns (address, symbol, decimals)
    const newCount = await hubGetters.getSyntheticTokenCount();
    console.log(`New token count: ${newCount}`);
    const newInfo = await hubGetters.getSyntheticTokenInfo(newCount.toNumber());
    sbtcAddress = newInfo[0]; // First element is the address
    console.log(`New sBTC address: ${sbtcAddress}`);
  }
  
  // Step 2: Link WBTC to sBTC
  console.log("\n--- Step 2: Linking WBTC to sBTC ---");
  console.log(`sBTC: ${sbtcAddress}`);
  console.log(`WBTC (Arbitrum): ${CONFIG.wbtcArbitrum}`);
  console.log(`Gateway (Arbitrum): ${CONFIG.arbitrumGateway}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  // decimalsDelta = syntheticDecimals - remoteDecimals = 8 - 8 = 0
  const decimalsDelta = CONFIG.syntheticDecimals - CONFIG.wbtcDecimals;
  console.log(`Decimals delta: ${decimalsDelta}`);
  
  const tx = await hub.manualLinkRemoteToken(
    sbtcAddress,
    CONFIG.arbitrumEid,
    CONFIG.wbtcArbitrum,
    CONFIG.arbitrumGateway,
    decimalsDelta,
    CONFIG.minBridgeAmt
  );
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log("✅ WBTC linked to sBTC!");
  
  // Step 3: Verify
  console.log("\n--- Step 3: Verifying link ---");
  const remoteInfo = await hubGetters.getRemoteTokenInfo(sbtcAddress, CONFIG.arbitrumEid);
  console.log(`Remote address: ${remoteInfo.remoteAddress}`);
  console.log(`Decimals delta: ${remoteInfo.decimalsDelta}`);
  console.log(`Min bridge: ${remoteInfo.minBridgeAmt}`);
  
  if (remoteInfo.remoteAddress.toLowerCase() === CONFIG.wbtcArbitrum.toLowerCase()) {
    console.log("\n✅ SUCCESS! WBTC is now linked to sBTC");
    console.log(`\nsBTC address for frontend: ${sbtcAddress}`);
  } else {
    console.log("\n❌ Link failed!");
  }
}

main().catch(console.error);

