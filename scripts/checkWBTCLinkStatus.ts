import { ethers } from "hardhat";

const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const SBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== CHECKING WBTC LINK STATUS ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  // Check if WBTC is linked
  console.log("Checking WBTC -> sBTC link...");
  try {
    const syntheticAddr = await hubGetters.getSyntheticAddressByRemoteAddress(ARBITRUM_EID, WBTC);
    console.log(`Synthetic for WBTC: ${syntheticAddr}`);
    
    if (syntheticAddr === ethers.constants.AddressZero) {
      console.log("❌ WBTC not linked yet - waiting for LZ message");
    } else if (syntheticAddr.toLowerCase() === SBTC.toLowerCase()) {
      console.log("✅ WBTC is linked to sBTC!");
    } else {
      console.log(`⚠️ WBTC linked to different token: ${syntheticAddr}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
  
  // Check sBTC remote info
  console.log("\nChecking sBTC remote info for Arbitrum...");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(SBTC, ARBITRUM_EID);
    console.log(`Remote address: ${remoteInfo.remoteAddress}`);
    console.log(`Decimals delta: ${remoteInfo.decimalsDelta}`);
    console.log(`Min bridge: ${remoteInfo.minBridgeAmt}`);
    console.log(`Total balance: ${remoteInfo.totalBalance}`);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

main().catch(console.error);
