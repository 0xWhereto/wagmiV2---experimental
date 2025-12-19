import { ethers } from "hardhat";

const CONFIG = {
  hub: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
  hubGetters: "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
  
  ethereum: { eid: 30101, wbtc: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  arbitrum: { eid: 30110, wbtc: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
};

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       DEBUGGING MANUAL LINK FAILURE                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const hubGetters = await ethers.getContractAt("SyntheticTokenHubGetters", CONFIG.hubGetters);

  // Check 1: Is sBTC registered?
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 1. Checking if sBTC is registered                           │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  try {
    const tokenIndex = await hubGetters.getTokenIndexByAddress(CONFIG.sBTC);
    console.log(`   sBTC token index: ${tokenIndex}`);
    if (tokenIndex.toNumber() === 0) {
      console.log("   ❌ sBTC is NOT registered (index = 0)");
    } else {
      console.log("   ✓ sBTC is registered");
    }
  } catch (e: any) {
    console.log(`   Error: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check 2: Is Ethereum WBTC already linked?
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 2. Checking if Ethereum WBTC is already linked              │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(CONFIG.sBTC, CONFIG.ethereum.eid);
    console.log(`   Remote address: ${remoteInfo.remoteAddress}`);
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("   ✓ Not linked yet - should be able to link");
    } else {
      console.log("   ❌ Already linked to:", remoteInfo.remoteAddress);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check 3: Is Arbitrum WBTC already linked?
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 3. Checking if Arbitrum WBTC is already linked              │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  try {
    const remoteInfo = await hubGetters.getRemoteTokenInfo(CONFIG.sBTC, CONFIG.arbitrum.eid);
    console.log(`   Remote address: ${remoteInfo.remoteAddress}`);
    if (remoteInfo.remoteAddress === ethers.constants.AddressZero) {
      console.log("   ✓ Not linked yet - should be able to link");
    } else {
      console.log("   ❌ Already linked to:", remoteInfo.remoteAddress);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.reason || e.message?.slice(0, 100)}`);
  }

  // Check 4: Check if there's a reverse mapping for WBTC
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 4. Checking reverse mappings (WBTC -> synthetic)            │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", CONFIG.hub);
  
  // Check _syntheticAddressByRemoteAddress mapping
  // This is internal, so we need to call it differently
  // Let's try to check via getSyntheticByRemote if such function exists
  console.log("   (Need to check internal mappings - may require direct storage read)");
}

main();

