import { ethers } from "hardhat";

const NEW_MIM = "0xf3DBF67010C7cAd25c152AB772F8Ef240Cc9c14f";
const OWNER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Redeploy MIMStakingVault with New MIM ===\n");
  
  // Deploy new StakingVault
  console.log("1. Deploying MIMStakingVaultV2...");
  const StakingVault = await ethers.getContractFactory("MIMStakingVaultV2");
  const vault = await StakingVault.deploy(NEW_MIM, OWNER);
  await vault.deployed();
  console.log("   MIMStakingVault deployed to:", vault.address);
  
  // Verify configuration
  console.log("\n2. Verifying configuration...");
  const mimAddress = await vault.mim();
  const treasury = await vault.treasury();
  console.log("   MIM token:", mimAddress);
  console.log("   Treasury:", treasury);
  
  // Seed with some initial MIM
  console.log("\n3. Seeding vault with initial MIM...");
  
  const mimABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ];
  const mim = await ethers.getContractAt(mimABI, NEW_MIM);
  const ownerMIMBalance = await mim.balanceOf(OWNER);
  console.log("   Owner MIM balance:", ethers.utils.formatUnits(ownerMIMBalance, 18));
  
  // Approve and deposit some MIM
  if (ownerMIMBalance.gt(0)) {
    const depositAmount = ownerMIMBalance.div(2); // Deposit half
    console.log("   Depositing:", ethers.utils.formatUnits(depositAmount, 18), "MIM");
    
    const approveTx = await mim.approve(vault.address, depositAmount);
    await approveTx.wait();
    
    const depositTx = await vault.deposit(depositAmount);
    await depositTx.wait();
    console.log("   ✓ Deposit complete!");
    
    // Check vault state
    const totalAssets = await vault.totalAssets();
    const vaultBalance = await vault.balanceOf(OWNER);
    console.log("   Vault total assets:", ethers.utils.formatUnits(totalAssets, 18));
    console.log("   Owner sMIM balance:", ethers.utils.formatUnits(vaultBalance, 18));
  }
  
  console.log("\n=== SUMMARY ===");
  console.log("NEW MIMStakingVault:", vault.address);
  console.log("MIM Token:", NEW_MIM);
}

main().catch(console.error);
