import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xa883C4f63b203D59769eE75900fBfE992A358f3D";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Check LeverageAMM config
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function mim() view returns (address)",
    "function stakingVault() view returns (address)",
    "function oracle() view returns (address)",
    "function underlyingAsset() view returns (address)",
    "function v3LPVault() view returns (address)",
  ], signer);
  
  console.log("LeverageAMM Config:");
  console.log("  mim:", await amm.mim());
  console.log("  stakingVault:", await amm.stakingVault());
  console.log("  oracle:", await amm.oracle());
  console.log("  underlyingAsset:", await amm.underlyingAsset());
  console.log("  v3LPVault:", await amm.v3LPVault());
  
  // Check StakingVault state
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function mim() view returns (address)",
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function isBorrower(address) view returns (bool)",
    "function utilizationRate() view returns (uint256)",
  ], signer);
  
  console.log("\nStakingVault State:");
  console.log("  mim:", await vault.mim());
  
  const cash = await vault.getCash();
  console.log("  getCash():", ethers.utils.formatEther(cash), "MIM");
  
  const borrows = await vault.totalBorrows();
  console.log("  totalBorrows():", ethers.utils.formatEther(borrows), "MIM");
  
  const isBorrower = await vault.isBorrower(LEVERAGE_AMM);
  console.log("  isBorrower(LeverageAMM):", isBorrower);
  
  // Check MIM balance in vault
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const vaultMimBalance = await mim.balanceOf(STAKING_VAULT);
  console.log("  MIM balance in vault:", ethers.utils.formatEther(vaultMimBalance));
  
  console.log("\n=== Issue Analysis ===");
  if (!isBorrower) {
    console.log("❌ LeverageAMM is NOT authorized as borrower!");
    console.log("   Need to call: stakingVault.setBorrower(leverageAMM, true)");
  }
  if (cash.eq(0)) {
    console.log("❌ StakingVault has no MIM liquidity!");
    console.log("   Need to deposit MIM to the staking vault first");
  }
}

main().catch(console.error);

