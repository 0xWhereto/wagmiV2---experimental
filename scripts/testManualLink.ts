import { ethers } from "hardhat";

async function main() {
  const hub = await ethers.getContractAt("SyntheticTokenHub", "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd");
  
  console.log("Testing manualLinkRemoteToken with static call...\n");
  
  try {
    // Try static call first to get revert reason without spending gas
    await hub.callStatic.manualLinkRemoteToken(
      "0x2F0324268031E6413280F3B5ddBc4A97639A284a", // sBTC
      30101,                                         // Ethereum EID
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // Ethereum WBTC
      "0xba36FC6568B953f691dd20754607590C59b7646a", // Ethereum Gateway
      0,                                             // decimals delta
      10000                                          // min bridge amount
    );
    console.log("Static call succeeded - transaction should work!");
  } catch (e: any) {
    console.log("Revert reason:", e.reason);
    console.log("\nFull error:", e.message?.slice(0, 800));
    
    // Check for specific errors
    if (e.message?.includes("Already linked")) {
      console.log("\n⚠️ WBTC is already linked to a synthetic token!");
    } else if (e.message?.includes("Synthetic token not found")) {
      console.log("\n⚠️ sBTC is not registered on the Hub!");
    } else if (e.message?.includes("Invalid remote")) {
      console.log("\n⚠️ Invalid remote token address!");
    }
  }
}

main();

