import { ethers } from "hardhat";

const LZ_ENDPOINT = "0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // First, check if we can interact with the LZ endpoint
  const endpointAbi = [
    "function setDelegate(address _delegate) external",
    "function delegates(address _caller) external view returns (address)"
  ];

  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  try {
    const currentDelegate = await endpoint.delegates(deployer.address);
    console.log("Current delegate for deployer:", currentDelegate);
  } catch (e: any) {
    console.log("Error reading delegates:", e.message);
  }

  // Try calling setDelegate directly first
  console.log("\nTrying to set delegate...");
  try {
    const tx = await endpoint.setDelegate(deployer.address, { gasLimit: 100000 });
    const receipt = await tx.wait();
    console.log("setDelegate success, gas used:", receipt.gasUsed.toString());
  } catch (e: any) {
    console.log("setDelegate failed:", e.reason || e.message);
  }
}

main().catch(console.error);
