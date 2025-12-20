import { ethers } from "hardhat";

const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  console.log("=== CHECKING NEW sBTC ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Total synthetic tokens: ${count}\n`);
  
  // Check the last few tokens (new sBTC should be at end)
  for (let i = Math.max(1, count.toNumber() - 5); i <= count.toNumber(); i++) {
    try {
      const info = await hubGetters.getSyntheticTokenInfo(i);
      console.log(`[${i}] ${info[1]}:`);
      console.log(`    Address: ${info[0]}`);
      console.log(`    Decimals: ${info[2]}`);
    } catch (e: any) {
      console.log(`[${i}] Error: ${e.message?.slice(0, 50)}`);
    }
  }
}

main().catch(console.error);
