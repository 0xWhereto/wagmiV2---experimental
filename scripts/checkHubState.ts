import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function owner() view returns (address)",
    "function isPaused() view returns (bool)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  console.log("Checking Hub state...");
  
  const owner = await hub.owner();
  console.log(`Owner: ${owner}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Is owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  
  try {
    const paused = await hub.isPaused();
    console.log(`Paused: ${paused}`);
  } catch (e) {
    console.log("isPaused not available");
  }
  
  // Try a simple ownership call to verify owner works
  const testAbi = ["function transferOwnership(address) external"];
  const testHub = new ethers.Contract(HUB_ADDRESS, testAbi, deployer);
  
  console.log("\nTrying owner-only call (will fail if not owner)...");
  try {
    // Don't actually change ownership, just estimate gas
    await testHub.estimateGas.transferOwnership(deployer.address);
    console.log("✅ Owner check passed");
  } catch (e: any) {
    console.log("❌ Owner check failed:", e.reason || e.message?.substring(0, 100));
  }
}

main().catch(console.error);
