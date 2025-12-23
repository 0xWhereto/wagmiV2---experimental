import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check StakingVault Utilization ===\n");
  
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function utilizationRate() view returns (uint256)",
    "function getCash() view returns (uint256)",
  ], signer);
  
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const cash = await vault.getCash();
  const totalBorrows = await vault.totalBorrows();
  const totalAssets = await vault.totalAssets();
  const utilization = await vault.utilizationRate();
  
  console.log("Cash (MIM balance):", ethers.utils.formatEther(cash));
  console.log("Total Borrows:", ethers.utils.formatEther(totalBorrows));
  console.log("Total Assets:", ethers.utils.formatEther(totalAssets));
  console.log("Current Utilization:", (parseFloat(ethers.utils.formatEther(utilization)) * 100).toFixed(2), "%");
  console.log("MAX_UTILIZATION: 90%");
  
  // Calculate max we can borrow
  // MAX_UTILIZATION = 0.90
  // newBorrows = totalBorrows + borrowAmount
  // newUtil = newBorrows / (cash + newBorrows)
  // We need: newUtil <= 0.90
  // newBorrows / (cash + newBorrows) <= 0.90
  // newBorrows <= 0.90 * (cash + newBorrows)
  // newBorrows <= 0.90 * cash + 0.90 * newBorrows
  // 0.10 * newBorrows <= 0.90 * cash
  // newBorrows <= 9 * cash
  // maxBorrow = 9 * cash - totalBorrows
  
  const maxNewBorrows = cash.mul(9);  // 0.90/(1-0.90) = 9
  const maxBorrow = maxNewBorrows.sub(totalBorrows);
  
  console.log("\nMax borrow to stay under 90%:", ethers.utils.formatEther(maxBorrow.gt(0) ? maxBorrow : ethers.BigNumber.from(0)), "MIM");
  
  // For 0.0002 sWETH at 3000 MIM/ETH, we need ~0.6 MIM
  const neededBorrow = ethers.utils.parseEther("0.6");
  console.log("Need to borrow:", ethers.utils.formatEther(neededBorrow), "MIM");
  
  if (maxBorrow.gte(neededBorrow)) {
    console.log("✓ Can borrow this amount");
  } else {
    console.log("✗ Cannot borrow - would exceed max utilization");
    console.log("  Need to deposit more MIM to StakingVault first!");
    
    // Calculate how much more MIM needed
    // To borrow X, we need: X <= 9 * cash - totalBorrows
    // cash >= (X + totalBorrows) / 9
    // Additional cash = (X + totalBorrows) / 9 - currentCash
    const neededCash = neededBorrow.add(totalBorrows).div(9);
    const additionalNeeded = neededCash.sub(cash);
    if (additionalNeeded.gt(0)) {
      console.log("  Additional MIM needed in vault:", ethers.utils.formatEther(additionalNeeded));
    }
  }
}
main().catch(console.error);
