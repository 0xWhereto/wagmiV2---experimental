import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

// The slot 3 address - let's check if it's the getters helper
const GETTERS_CANDIDATE = "0x3a27f366e09fe76a50dd50d415c770f6caf0f3e6";

async function main() {
  console.log("=== Use Getters Helper ===");
  
  // Deploy the SyntheticTokenHubGetters helper
  console.log("Deploying SyntheticTokenHubGetters helper...");
  const Getters = await ethers.getContractFactory("SyntheticTokenHubGetters");
  const getters = await Getters.deploy(HUB_ADDRESS);
  await getters.deployed();
  console.log("Getters deployed at:", getters.address);
  
  // Now use it to query Hub state
  console.log("\nQuerying Hub state...");
  
  try {
    const synthCount = await getters.getSyntheticTokensLength();
    console.log("Synthetic tokens count:", synthCount.toString());
    
    if (synthCount.gt(0)) {
      console.log("\nSynthetic tokens:");
      for (let i = 0; i < synthCount.toNumber(); i++) {
        const token = await getters.getSyntheticTokenByIndex(i);
        console.log(`  [${i}]: ${token.name} (${token.decimals} dec) @ ${token.tokenAddress}`);
      }
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 80));
  }
  
  try {
    const remoteCount = await getters.getRemoteTokensLength(ARB_EID);
    console.log("\nRemote tokens from Arbitrum:", remoteCount.toString());
    
    if (remoteCount.gt(0)) {
      console.log("Remote tokens:");
      for (let i = 0; i < remoteCount.toNumber(); i++) {
        const token = await getters.getRemoteTokenByIndex(ARB_EID, i);
        console.log(`  [${i}]: ${token.tokenAddress} -> ${token.syntheticTokenAddress}`);
      }
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 80));
  }
}

main().catch(console.error);
