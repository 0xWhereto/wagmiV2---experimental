import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  console.log("=== Check Hub Tokens ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  // Get remote tokens for Arbitrum
  console.log("\nChecking for USDC from Arbitrum...");
  try {
    const remotesLength = await hub.getRemoteTokensByEidLength(ARB_EID);
    console.log("Remote tokens from Arbitrum:", remotesLength.toString());
    
    if (remotesLength.gt(0)) {
      for (let i = 0; i < remotesLength.toNumber(); i++) {
        const remote = await hub.getRemoteTokensByEid(ARB_EID, i);
        console.log(`  [${i}]:`, remote);
      }
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 50));
  }
  
  // Try to get synthetic token for USDC
  console.log("\nLooking for synthetic token...");
  try {
    // Check if there's a mapping function
    const gettersAddr = "0x72F66b60be8c20EE04c4c0C952e15eaC2A05E32b"; // SyntheticTokenHubGetters if deployed
    const code = await ethers.provider.getCode(gettersAddr);
    console.log("Getters deployed:", code !== "0x");
  } catch (e: any) {
    console.log("Error checking getters:", e.reason || e.message?.slice(0, 50));
  }
  
  // Check Hub owner
  const owner = await hub.owner();
  console.log("\nHub owner:", owner);
  
  // Check if the message arrived - let's look at the peer
  const peer = await hub.peers(ARB_EID);
  console.log("Peer for Arbitrum:", peer);
}

main().catch(console.error);
