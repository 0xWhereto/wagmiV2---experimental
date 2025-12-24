import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS = "0x2801131F630Fe5Cfb2f6349e40cA28a29C9788a7";

async function main() {
  console.log("=== Query Synthetic Tokens ===");
  
  const getters = await ethers.getContractAt("SyntheticTokenHubGetters", GETTERS);
  
  // Query each synthetic token
  console.log("Querying 14 synthetic tokens...\n");
  
  for (let i = 0; i < 14; i++) {
    try {
      const info = await getters.getSyntheticTokenInfo(i);
      console.log(`[${i}] ${info.name}`);
      console.log(`    Address: ${info.tokenAddress}`);
      console.log(`    Decimals: ${info.decimals}`);
      console.log(`    Chains: ${info.linkedChainEids.map((e: any) => e.toString()).join(", ")}`);
      console.log();
    } catch (e: any) {
      console.log(`[${i}] Error:`, e.reason || e.message?.slice(0, 50));
    }
  }
}

main().catch(console.error);
