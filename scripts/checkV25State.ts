import { ethers } from "hardhat";

const V3_VAULT = "0x63d6136e4Eb939decc5ABff6273428C5d801a894";
const LEVERAGE_AMM = "0x1254e4e88eD6F13C87A9E15e91Ec9C331881c0aB";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check V25 State ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  
  const LeverageAMM = await ethers.getContractFactory("LeverageAMM");
  const leverageAMM = LeverageAMM.attach(LEVERAGE_AMM);
  
  console.log("V3LPVault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("V3LPVault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("V3 getTotalAssets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  
  console.log("\nLeverageAMM totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("LeverageAMM is operator:", await v3Vault.isOperator(LEVERAGE_AMM));
  console.log("LeverageAMM wToken:", await leverageAMM.wToken());
  
  // Check StakingVault
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function isBorrower(address) view returns (bool)",
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)"
  ], signer);
  console.log("\nStakingVault isBorrower(LeverageAMM):", await stakingVault.isBorrower(LEVERAGE_AMM));
  console.log("StakingVault totalAssets:", ethers.utils.formatEther(await stakingVault.totalAssets()));
  console.log("StakingVault totalBorrows:", ethers.utils.formatEther(await stakingVault.totalBorrows()));
}
main().catch(console.error);
