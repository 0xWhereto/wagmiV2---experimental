import { ethers } from "hardhat";

/**
 * Create sBTC synthetic token on the Hub
 * This must be done BEFORE linking WBTC from gateways
 */

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       CREATING sBTC SYNTHETIC TOKEN                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\nDeployer:", deployer.address);

  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  // Check if we're the owner
  const owner = await hub.owner();
  console.log("Hub owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ You are not the Hub owner. Cannot create synthetic tokens.");
    return;
  }

  // Check current token count
  const hubGetters = await ethers.getContractAt(
    "SyntheticTokenHubGetters", 
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );
  
  const tokenCountBefore = await hubGetters.getSyntheticTokenCount();
  console.log(`\nCurrent synthetic token count: ${tokenCountBefore}`);

  // Create sBTC (WBTC has 8 decimals)
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Creating sBTC (8 decimals)                                  │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  try {
    const tx = await hub.createSyntheticToken("sBTC", 8);
    console.log(`   Tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✓ Transaction confirmed! Block: ${receipt.blockNumber}`);
    
    // Get the new token address from events
    const event = receipt.events?.find((e: any) => e.event === "SyntheticTokenCreated");
    if (event) {
      console.log(`   ✓ sBTC created at: ${event.args?.syntheticToken}`);
    }
    
    // Check new token count
    const tokenCountAfter = await hubGetters.getSyntheticTokenCount();
    console.log(`\n   Token count after: ${tokenCountAfter}`);
    
  } catch (e: any) {
    console.log(`   ✗ Failed: ${e.message?.slice(0, 200)}`);
    if (e.message.includes("already exists")) {
      console.log("   sBTC might already exist!");
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    NEXT STEPS                                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
   1. sBTC is now created on the Hub
   2. You need to RETRY the failed WBTC linking messages
   3. Use LayerZero's retry mechanism or re-send from gateways
  `);
}

main();

