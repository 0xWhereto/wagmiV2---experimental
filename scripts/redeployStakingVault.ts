import { ethers } from "hardhat";

const NEW_MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  // Deploy new StakingVault with correct MIM
  console.log("\nDeploying MIMStakingVault...");
  const StakingVault = await ethers.getContractFactory("contracts/0IL/core/MIMStakingVault.sol:MIMStakingVault");
  const vault = await StakingVault.deploy(NEW_MIM, deployer.address); // MIM address and treasury
  await vault.deployed();
  console.log("StakingVault deployed to:", vault.address);
  
  // Verify it's configured correctly
  const mim = await vault.mim();
  const asset = await vault.asset();
  console.log("\nConfiguration:");
  console.log("  mim():", mim);
  console.log("  asset():", asset);
  console.log("  Matches NEW_MIM:", mim.toLowerCase() === NEW_MIM.toLowerCase());
  
  // Test deposit preview
  const testAmount = ethers.utils.parseEther("1");
  const shares = await vault.previewDeposit(testAmount);
  console.log("  Preview 1 MIM deposit -> shares:", ethers.utils.formatEther(shares));
  
  console.log("\n=== Update Frontend ===");
  console.log(`stakingVault: "${vault.address}",`);
}

main().catch(console.error);

