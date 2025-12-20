import { ethers } from "hardhat";

const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== ALL SYNTHETIC TOKENS ON HUB ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  const count = await hubGetters.getSyntheticTokenCount();
  console.log(`Total synthetic tokens: ${count}\n`);
  
  for (let i = 1; i <= count.toNumber(); i++) {
    try {
      const info = await hubGetters.getSyntheticTokenInfo(i);
      console.log(`[${i}] ${info[1]}:`);
      console.log(`    Address: ${info[0]}`);
      console.log(`    Decimals: ${info[2]}`);
      
      // Check if linked to Arbitrum
      try {
        const remoteInfo = await hubGetters.getRemoteTokenInfo(info[0], ARBITRUM_EID);
        if (remoteInfo.remoteAddress !== ethers.constants.AddressZero) {
          console.log(`    → Arbitrum: ${remoteInfo.remoteAddress}`);
        }
      } catch (e) {}
      
    } catch (e: any) {
      console.log(`[${i}] Error: ${e.reason || e.message?.slice(0, 50)}`);
    }
    console.log();
  }
}

main().catch(console.error);
