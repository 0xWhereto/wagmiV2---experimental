import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const LEVERAGE_AMM = "0x9cD4a897f49590d3E524d1abB828cB6673d54B8D";
const ORACLE = "0xeD77B9f54cc9ACb496916a4fED764869E927FFcb";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check Staking Vault Liquidity ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function isBorrower(address) view returns (bool)",
    "function mim() view returns (address)"
  ], signer);
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function oracle() view returns (address)",
    "function stakingVault() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function wToken() view returns (address)"
  ], signer);
  
  const oracle = new ethers.Contract(ORACLE, [
    "function getPrice() view returns (uint256)"
  ], signer);
  
  console.log("StakingVault MIM address:", await stakingVault.mim());
  console.log("LeverageAMM oracle:", await leverageAMM.oracle());
  console.log("LeverageAMM stakingVault:", await leverageAMM.stakingVault());
  console.log("LeverageAMM v3LPVault:", await leverageAMM.v3LPVault());
  console.log("LeverageAMM wToken:", await leverageAMM.wToken());
  
  const totalAssets = await stakingVault.totalAssets();
  const totalBorrows = await stakingVault.totalBorrows();
  console.log("\nStakingVault total assets:", ethers.utils.formatEther(totalAssets), "MIM");
  console.log("StakingVault total borrows:", ethers.utils.formatEther(totalBorrows), "MIM");
  console.log("Available liquidity:", ethers.utils.formatEther(totalAssets.sub(totalBorrows)), "MIM");
  console.log("Is LeverageAMM borrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
  
  console.log("\nOracle price:", ethers.utils.formatEther(await oracle.getPrice()), "MIM per sWETH");
  
  // Test deposit amount calculation
  const depositAmount = ethers.utils.parseEther("0.0005");
  const price = await oracle.getPrice();
  const mimNeeded = depositAmount.mul(price).div(ethers.utils.parseEther("1"));
  console.log("\nFor 0.0005 sWETH deposit:");
  console.log("  MIM needed to borrow:", ethers.utils.formatEther(mimNeeded));
}
main().catch(console.error);
