import { ethers } from "hardhat";

async function main() {
  console.log("Getting all synthetic token addresses...\n");
  
  const hubGetters = await ethers.getContractAt(
    "SyntheticTokenHubGetters",
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );

  // Get each token individually
  for (let i = 1; i <= 4; i++) {
    try {
      // Use getSyntheticTokenInfo to just get basic info without chain data
      const info = await hubGetters.getSyntheticTokenInfo(i);
      console.log(`Token ${i}:`);
      console.log(`  Symbol: ${info.syntheticTokenInfo.symbol}`);
      console.log(`  Address: ${info.syntheticTokenInfo.tokenAddress}`);
      console.log(`  Decimals: ${info.syntheticTokenInfo.decimals}`);
      console.log();
    } catch (e: any) {
      console.log(`Token ${i}: Error - ${e.reason || e.message?.slice(0, 50)}`);
    }
  }
}

main();


