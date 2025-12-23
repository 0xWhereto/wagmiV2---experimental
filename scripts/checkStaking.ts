import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check StakingVault ===\n");
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function isBorrower(address) view returns (bool)"
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const totalAssets = await stakingVault.totalAssets();
  const totalBorrows = await stakingVault.totalBorrows();
  const mimBalance = await mim.balanceOf(STAKING_VAULT);
  
  console.log("StakingVault totalAssets:", ethers.utils.formatEther(totalAssets), "MIM");
  console.log("StakingVault totalBorrows:", ethers.utils.formatEther(totalBorrows), "MIM");
  console.log("Available liquidity:", ethers.utils.formatEther(totalAssets.sub(totalBorrows)), "MIM");
  console.log("Actual MIM balance:", ethers.utils.formatEther(mimBalance), "MIM");
  
  // Check how much MIM we need for a 0.0005 sWETH deposit
  const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";
  const oracle = new ethers.Contract(ORACLE, [
    "function getPrice() view returns (uint256)"
  ], signer);
  const price = await oracle.getPrice();
  const depositAmount = ethers.utils.parseEther("0.0005");
  const mimNeeded = depositAmount.mul(price).div(ethers.utils.parseEther("1"));
  
  console.log("\nOracle price:", ethers.utils.formatEther(price), "MIM per sWETH");
  console.log("For 0.0005 sWETH deposit, need:", ethers.utils.formatEther(mimNeeded), "MIM");
  console.log("Is enough:", totalAssets.sub(totalBorrows).gte(mimNeeded));
}
main().catch(console.error);
