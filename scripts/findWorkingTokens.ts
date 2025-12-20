import { ethers } from "hardhat";

const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

// Working tokens we know
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== FINDING WORKING TOKEN PATTERN ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  // Check sUSDC
  console.log("--- sUSDC (known working) ---");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SUSDC, ARBITRUM_EID);
    console.log(`Address: ${SUSDC}`);
    console.log(`Remote: ${remoteInfo.remoteAddress}`);
    console.log(`Balance: ${remoteInfo.totalBalance}`);
    
    const tokenIndex = await hubGetters.getTokenIndexByAddress(SUSDC);
    console.log(`Token Index: ${tokenIndex}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Check sWETH
  console.log("\n--- sWETH (known working) ---");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SWETH, ARBITRUM_EID);
    console.log(`Address: ${SWETH}`);
    console.log(`Remote: ${remoteInfo.remoteAddress}`);
    console.log(`Balance: ${remoteInfo.totalBalance}`);
    
    const tokenIndex = await hubGetters.getTokenIndexByAddress(SWETH);
    console.log(`Token Index: ${tokenIndex}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
