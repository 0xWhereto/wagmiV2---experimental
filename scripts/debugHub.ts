import hardhat, { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const network = hardhat.network.name;
  if (network !== "sonic") {
    console.log("This script should be run on Sonic network");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Try to call owner
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  
  console.log("\n--- Hub Contract Check ---");
  
  try {
    const owner = await hub.owner();
    console.log(`Owner: ${owner}`);
    console.log(`Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (e: any) {
    console.log(`Failed to get owner: ${e.message?.slice(0, 100)}`);
  }

  // Check if manualLinkRemoteToken selector exists
  console.log("\n--- Checking function selectors ---");
  const provider = ethers.provider;
  const code = await provider.getCode(HUB_ADDRESS);
  
  // manualLinkRemoteToken(address,uint32,address,address,int8,uint256)
  // selector = first 4 bytes of keccak256 of function signature
  const selector = ethers.utils.id("manualLinkRemoteToken(address,uint32,address,address,int8,uint256)").slice(0, 10);
  console.log(`manualLinkRemoteToken selector: ${selector}`);
  console.log(`Selector in bytecode: ${code.includes(selector.slice(2))}`);

  // Try calling createSyntheticToken to see if owner check works
  console.log("\n--- Testing owner-only function ---");
  try {
    // This should fail with "already exists" or succeed, not revert silently
    await hub.callStatic.createSyntheticToken("TEST", 18);
    console.log("createSyntheticToken call would succeed (owner check passed)");
  } catch (e: any) {
    console.log(`createSyntheticToken error: ${e.message?.slice(0, 150)}`);
    if (e.reason) console.log(`Reason: ${e.reason}`);
  }

  // Check syntheticTokens mapping directly
  console.log("\n--- Direct storage read test ---");
  try {
    // Try to get storage slot data
    const slot6 = await hub.getStorageSlotData(6); // _syntheticTokenCount slot
    console.log(`Synthetic token count (raw): ${slot6}`);
  } catch (e: any) {
    console.log(`getStorageSlotData error: ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



