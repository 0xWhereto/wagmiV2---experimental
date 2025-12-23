import { ethers } from "hardhat";

const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SimpleOracle with:", deployer.address);
  
  const SimpleOracle = await ethers.getContractFactory("contracts/0IL/core/SimpleOracle.sol:SimpleOracle");
  const oracle = await SimpleOracle.deploy(SWETH_MIM_POOL);
  await oracle.deployed();
  console.log("SimpleOracle deployed:", oracle.address);
  
  // Test it
  const price = await oracle.getPrice();
  console.log("getPrice():", ethers.utils.formatEther(price), "MIM per sWETH");
  
  const inversePrice = await oracle.getInversePrice();
  console.log("getInversePrice():", ethers.utils.formatEther(inversePrice), "sWETH per MIM");
  
  console.log("\n=== SimpleOracle deployed ===");
  console.log("Address:", oracle.address);
}

main().catch(console.error);

