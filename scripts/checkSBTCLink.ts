import { ethers } from "hardhat";

const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const ARBITRUM_EID = 30110;
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

// Multiple sBTC addresses exist - need to find which is linked
const SBTC_CANDIDATES = [
  "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  "0x221Be78CCE1465946eA17e44aa08C4b756983b5F",
  "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C",
  "0xcb84ade32Bb4E9053F9cA8D641bfD35Cb7Fe1f0c",
];

async function main() {
  console.log("=== CHECKING SBTC LINK TO ARBITRUM WBTC ===\n");
  
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  // Method 1: Check if we can find sWBTC by remote address
  console.log("--- Checking by remote address ---");
  try {
    const syntheticAddr = await hubGetters.getSyntheticAddressByRemoteAddress(ARBITRUM_EID, WBTC_ARBITRUM);
    console.log(`sWBTC for Arbitrum WBTC: ${syntheticAddr}`);
    if (syntheticAddr !== ethers.constants.AddressZero) {
      console.log("✅ WBTC is linked to Hub!");
    } else {
      console.log("❌ WBTC is NOT linked to Hub");
    }
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message?.slice(0, 100)}`);
  }
  
  // Method 2: Check each sBTC candidate
  console.log("\n--- Checking each sBTC candidate ---");
  for (const sbtc of SBTC_CANDIDATES) {
    try {
      const remoteInfo = await hubGetters.getRemoteTokenInfo(sbtc, ARBITRUM_EID);
      console.log(`\n${sbtc}:`);
      console.log(`  Remote: ${remoteInfo.remoteAddress}`);
      console.log(`  DecimalsDelta: ${remoteInfo.decimalsDelta}`);
      console.log(`  Balance: ${ethers.utils.formatUnits(remoteInfo.totalBalance, 8)}`);
      
      if (remoteInfo.remoteAddress.toLowerCase() === WBTC_ARBITRUM.toLowerCase()) {
        console.log("  ✅ THIS IS THE CORRECT sBTC FOR ARBITRUM WBTC!");
      }
    } catch (e: any) {
      console.log(`${sbtc}: Not linked to Arbitrum`);
    }
  }
}

main().catch(console.error);
