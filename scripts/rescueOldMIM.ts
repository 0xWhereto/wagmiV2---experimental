import { ethers } from "hardhat";

const OLD_MIM = "0x9ea06883EE9aA5F93d68fb3E85C4Cf44f4C01073";
const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const OWNER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Rescue sUSDC from Old MIM ===");
  
  const mimABI = [
    "function rescueTokens(address token, address to, uint256 amount) external",
    "function owner() view returns (address)"
  ];
  const mim = await ethers.getContractAt(mimABI, OLD_MIM);
  
  // Check owner
  const owner = await mim.owner();
  console.log("Owner:", owner);
  
  // Check sUSDC balance
  const erc20ABI = ["function balanceOf(address) view returns (uint256)"];
  const usdc = await ethers.getContractAt(erc20ABI, sUSDC);
  const balance = await usdc.balanceOf(OLD_MIM);
  console.log("sUSDC in old MIM:", ethers.utils.formatUnits(balance, 6));
  
  if (balance.gt(0)) {
    console.log("\nRescuing sUSDC...");
    const tx = await mim.rescueTokens(sUSDC, OWNER, balance);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Rescued!");
    
    // Verify
    const newBalance = await usdc.balanceOf(OLD_MIM);
    console.log("sUSDC remaining:", ethers.utils.formatUnits(newBalance, 6));
  }
}

main().catch(console.error);
