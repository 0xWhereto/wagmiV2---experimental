import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Seed StakingVault with MIM ===\n");
  
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function utilizationRate() view returns (uint256)",
    "function deposit(uint256) returns (uint256)",
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const myMIM = await mim.balanceOf(signer.address);
  console.log("My MIM balance:", ethers.utils.formatEther(myMIM));
  
  // Deposit 5 MIM to bring utilization down
  const depositAmount = ethers.utils.parseEther("5");
  
  if (myMIM.lt(depositAmount)) {
    console.log("Not enough MIM, depositing all:", ethers.utils.formatEther(myMIM));
    
    // Approve and deposit all
    await (await mim.approve(STAKING_VAULT, myMIM)).wait();
    const tx = await vault.deposit(myMIM, { gasLimit: 500000 });
    await tx.wait();
    console.log("✓ Deposited all MIM");
  } else {
    // Approve and deposit 5 MIM
    console.log("Depositing 5 MIM...");
    await (await mim.approve(STAKING_VAULT, depositAmount)).wait();
    const tx = await vault.deposit(depositAmount, { gasLimit: 500000 });
    await tx.wait();
    console.log("✓ Deposited 5 MIM");
  }
  
  // Check new utilization
  const newUtil = await vault.utilizationRate();
  const newAssets = await vault.totalAssets();
  const newBorrows = await vault.totalBorrows();
  
  console.log("\nNew state:");
  console.log("Total Assets:", ethers.utils.formatEther(newAssets));
  console.log("Total Borrows:", ethers.utils.formatEther(newBorrows));
  console.log("New Utilization:", (parseFloat(ethers.utils.formatEther(newUtil)) * 100).toFixed(2), "%");
  
  // Calculate max borrow now
  const cash = newAssets.sub(newBorrows);
  const maxNewBorrows = cash.mul(9);
  const maxBorrow = maxNewBorrows.sub(newBorrows);
  console.log("Max borrow now:", ethers.utils.formatEther(maxBorrow.gt(0) ? maxBorrow : ethers.BigNumber.from(0)), "MIM");
}
main().catch(console.error);
