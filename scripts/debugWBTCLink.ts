import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const HUB_GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const SBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== DEBUG WBTC LINK ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", HUB_GETTERS);
  
  // Check owner
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  // Check if sBTC exists
  console.log("\nChecking sBTC...");
  try {
    const tokenIndex = await hubGetters.getTokenIndexByAddress(SBTC);
    console.log(`sBTC token index: ${tokenIndex}`);
    
    if (tokenIndex.eq(0)) {
      console.log("❌ sBTC is not a registered synthetic token!");
    } else {
      console.log("✅ sBTC is a registered synthetic token");
    }
  } catch (e: any) {
    console.log(`Error: ${e.reason || e.message}`);
  }
  
  // Check if WBTC is already linked
  console.log("\nChecking if WBTC already linked...");
  try {
    const existing = await hubGetters.getSyntheticAddressByRemoteAddress(ARBITRUM_EID, WBTC);
    console.log(`Existing synthetic for WBTC: ${existing}`);
    if (existing !== ethers.constants.AddressZero) {
      console.log("❌ WBTC is already linked to another synthetic!");
    } else {
      console.log("✅ WBTC is not linked yet");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
  
  // Try to call with staticCall to get revert reason
  console.log("\nTrying static call...");
  try {
    await hub.callStatic.manualLinkRemoteToken(
      SBTC,
      ARBITRUM_EID,
      WBTC,
      "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
      0,
      1000
    );
    console.log("✅ Static call succeeded");
  } catch (e: any) {
    console.log(`❌ Static call failed: ${e.reason || e.message}`);
  }
}

main().catch(console.error);
