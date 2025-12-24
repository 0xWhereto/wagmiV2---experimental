import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  console.log("=== Read Hub Storage ===");
  
  // Read storage slots to find synthetic tokens array
  for (let i = 0; i < 20; i++) {
    const slot = await ethers.provider.getStorageAt(HUB_ADDRESS, i);
    if (slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log(`Slot ${i}:`, slot);
    }
  }
  
  // The Hub should have a syntheticTokens array - let's check what functions it has
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  console.log("\nTrying to get syntheticTokens...");
  try {
    // Try index 0, 1, 2
    for (let i = 0; i < 5; i++) {
      try {
        const token = await hub.syntheticTokens(i);
        console.log(`syntheticTokens[${i}]:`, token);
      } catch (e) {
        console.log(`syntheticTokens[${i}]: not accessible`);
        break;
      }
    }
  } catch (e: any) {
    console.log("syntheticTokens not accessible:", e.message?.slice(0, 50));
  }
  
  // Try _syntheticTokenAddresses
  console.log("\nTrying _syntheticTokenAddresses...");
  try {
    for (let i = 0; i < 5; i++) {
      try {
        const token = await hub._syntheticTokenAddresses(i);
        console.log(`_syntheticTokenAddresses[${i}]:`, token);
      } catch (e) {
        break;
      }
    }
  } catch (e) {
    console.log("Not accessible");
  }
}

main().catch(console.error);
