import { ethers } from "hardhat";

async function main() {
  const hubCode = await ethers.provider.getCode("0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd");
  
  // Function selector for manualLinkRemoteToken(address,uint32,address,address,int8,uint256)
  const selector = ethers.utils.id("manualLinkRemoteToken(address,uint32,address,address,int8,uint256)").slice(0, 10);
  console.log("manualLinkRemoteToken selector:", selector);
  console.log("In Hub bytecode:", hubCode.includes(selector.slice(2)) ? "FOUND" : "NOT FOUND");
  
  // Also check createSyntheticToken
  const createSelector = ethers.utils.id("createSyntheticToken(string,uint8)").slice(0, 10);
  console.log("createSyntheticToken selector:", createSelector);
  console.log("In Hub bytecode:", hubCode.includes(createSelector.slice(2)) ? "FOUND" : "NOT FOUND");
  
  // Check other functions
  const ownerSelector = ethers.utils.id("owner()").slice(0, 10);
  console.log("owner() selector:", ownerSelector);
  console.log("In Hub bytecode:", hubCode.includes(ownerSelector.slice(2)) ? "FOUND" : "NOT FOUND");

  console.log("\nHub code length:", hubCode.length / 2 - 1, "bytes");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });


