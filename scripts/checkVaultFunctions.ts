import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check Vault Emergency Functions ===\n");
  
  // Get the deployed MIMStakingVault contract
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  const vault = MIMStakingVault.attach(STAKING_VAULT);
  
  // Check if there's a rescue function
  console.log("Looking for emergency functions...");
  
  // Try to call withdrawReserves as owner
  try {
    const reserves = await vault.totalReserves();
    console.log("Total reserves:", ethers.utils.formatEther(reserves));
  } catch (e) {
    console.log("No totalReserves function");
  }
  
  // Static call withdraw to see error
  console.log("\nTrying static call withdraw(1 share)...");
  try {
    const oneShare = ethers.utils.parseEther("1");
    await vault.callStatic.withdraw(oneShare);
    console.log("Static call succeeded");
  } catch (err: any) {
    console.log("Error:", err.reason || err.message?.slice(0, 200));
    if (err.data) {
      console.log("Error data:", err.data);
    }
  }
  
  // Check if MIM can be directly transferred out by owner
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)"
  ], signer);
  
  const mimInVault = await mim.balanceOf(STAKING_VAULT);
  console.log("\nMIM in vault:", ethers.utils.formatEther(mimInVault));
  
  // Check if vault has any direct transfer functions for owner
  console.log("\nChecking for rescueTokens function...");
  try {
    // This will fail if function doesn't exist
    await vault.rescueTokens(MIM, ethers.utils.parseEther("1"));
  } catch (e: any) {
    if (e.message?.includes("is not a function")) {
      console.log("No rescueTokens function exists");
    } else {
      console.log("rescueTokens might exist but failed:", e.reason || e.message?.slice(0, 100));
    }
  }
}
main().catch(console.error);
