import { ethers } from "hardhat";

const LZ_ENDPOINT = "0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} S`);

  // Deploy with explicit parameters
  console.log("\n1. Deploying SyntheticTokenHub...");
  const Hub = await ethers.getContractFactory("SyntheticTokenHub");
  
  try {
    // Deploy with factory.deploy() - this time use a proper balancer
    // Since we don't have a balancer, use deployer address as placeholder
    const hub = await Hub.deploy(
      LZ_ENDPOINT,
      deployer.address, // owner
      "0x0000000000000000000000000000000000000000", // uniswap universal router (not used)
      "0x0000000000000000000000000000000000000000", // permit2 (not used)
      deployer.address, // balancer (set to deployer for now)
      { gasLimit: 8000000 }
    );
    
    console.log("Waiting for deployment confirmation...");
    await hub.deployed();
    console.log(`✅ SyntheticTokenHub deployed at: ${hub.address}`);
    
    // Verify owner
    const owner = await hub.owner();
    console.log(`Owner: ${owner}`);
    
    return hub.address;
  } catch (e: any) {
    console.log("Deployment failed:", e.message);
    
    // Try to extract revert reason
    if (e.receipt) {
      console.log("Receipt status:", e.receipt.status);
      console.log("Gas used:", e.receipt.gasUsed?.toString());
    }
    throw e;
  }
}

main().catch(console.error);
