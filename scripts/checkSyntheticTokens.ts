import { ethers } from "hardhat";

async function main() {
  const hubGetters = await ethers.getContractAt(
    "SyntheticTokenHubGetters",
    "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e"
  );

  console.log("\n=== ALL SYNTHETIC TOKENS ON SONIC HUB ===\n");

  try {
    const count = await hubGetters.getSyntheticTokenCount();
    console.log(`Total synthetic tokens: ${count}\n`);
    
    // Get tokens info using indices array (1-based)
    const indices = [];
    for (let i = 1; i <= count.toNumber(); i++) {
      indices.push(i);
    }
    
    const tokens = await hubGetters.getSyntheticTokensInfo(indices);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      console.log(`[${i+1}] ${token.syntheticTokenInfo.symbol}`);
      console.log(`    Address: ${token.syntheticTokenInfo.tokenAddress}`);
      console.log(`    Decimals: ${token.syntheticTokenInfo.decimals}`);
      console.log(`    Remote tokens: ${token.remoteTokens.length}`);
      for (const remote of token.remoteTokens) {
        console.log(`      - EID ${remote.remoteEid}: ${remote.remoteTokenInfo.remoteAddress}`);
      }
      console.log();
    }
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main();

