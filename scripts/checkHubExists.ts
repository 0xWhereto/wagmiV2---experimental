import { ethers } from "hardhat";

async function main() {
  const HUB_ADDRESS = "0xD107D49C9B2E65d0D426622F5a072dc389b11B31";
  const HUB_GETTERS = "0xeE1aa06F55c77B5CF24fDE91B0F9E2c465A9e0C4";
  
  const provider = ethers.provider;
  
  console.log("Checking if contracts exist...\n");
  
  // Check Hub bytecode
  const hubCode = await provider.getCode(HUB_ADDRESS);
  console.log(`Hub (${HUB_ADDRESS}): ${hubCode.length > 2 ? 'EXISTS (' + hubCode.length + ' bytes)' : 'NO CODE'}`);
  
  // Check Hub Getters bytecode
  const gettersCode = await provider.getCode(HUB_GETTERS);
  console.log(`Hub Getters (${HUB_GETTERS}): ${gettersCode.length > 2 ? 'EXISTS (' + gettersCode.length + ' bytes)' : 'NO CODE'}`);
  
  // Try calling hub functions with raw calls
  console.log("\n--- Testing Hub function calls ---");
  
  // Test owner() - selector: 0x8da5cb5b
  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: "0x8da5cb5b" // owner()
    });
    console.log(`owner() result: ${result}`);
    if (result !== "0x") {
      const owner = ethers.utils.defaultAbiCoder.decode(["address"], result)[0];
      console.log(`  Decoded owner: ${owner}`);
    }
  } catch (e: any) {
    console.log(`owner() error: ${e.message?.slice(0, 100)}`);
  }
  
  // Test endpoint() - selector: 0x5e280f11
  try {
    const result = await provider.call({
      to: HUB_ADDRESS,
      data: "0x5e280f11" // endpoint()
    });
    console.log(`endpoint() result: ${result}`);
    if (result !== "0x") {
      const endpoint = ethers.utils.defaultAbiCoder.decode(["address"], result)[0];
      console.log(`  Decoded endpoint: ${endpoint}`);
    }
  } catch (e: any) {
    console.log(`endpoint() error: ${e.message?.slice(0, 100)}`);
  }
  
  // Check Gateway on Arbitrum
  const ARBITRUM_GATEWAY = "0x4B197E5AcDd88b71aD6dD580c02A3d59b24AA3f7";
  console.log(`\n--- Checking Arbitrum Gateway: ${ARBITRUM_GATEWAY} ---`);
  
  // We need to check if WETH is linked on the Arbitrum Gateway
  // by checking the availableTokens mapping
  console.log("Note: This script runs on Sonic, so cannot check Arbitrum directly.");
  console.log("The issue is likely that the token link message was never received by the Hub.");
  
  // Check if there's any synthetic token
  console.log("\n--- Checking _syntheticAddressByRemoteAddress mapping ---");
  // Function: _syntheticAddressByRemoteAddress(uint32,address) - but this is internal
  // We need to check via the getters contract
  
  // Let's check the getters with proper function signatures
  console.log("\n--- Hub Getters raw calls ---");
  
  // getSyntheticTokenCount() - need to compute selector
  const getSyntheticTokenCountSig = ethers.utils.id("getSyntheticTokenCount()").slice(0, 10);
  console.log(`getSyntheticTokenCount selector: ${getSyntheticTokenCountSig}`);
  
  try {
    const result = await provider.call({
      to: HUB_GETTERS,
      data: getSyntheticTokenCountSig
    });
    console.log(`getSyntheticTokenCount() result: ${result}`);
    if (result !== "0x") {
      const count = ethers.BigNumber.from(result);
      console.log(`  Decoded count: ${count.toString()}`);
    }
  } catch (e: any) {
    console.log(`getSyntheticTokenCount() error: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

