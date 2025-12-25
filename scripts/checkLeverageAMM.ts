import { ethers } from "hardhat";

const LEVERAGE_AMM = "0x9D21e8585cD05334F1E41b37CCEd3eD1923D0Fef";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function mim() view returns (address)",
    "function stakingVault() view returns (address)",
    "function oracle() view returns (address)",
  ], signer);
  
  console.log("LeverageAMM Config:");
  
  try {
    console.log("  mim():", await amm.mim());
  } catch (e: any) {
    console.log("  mim() error:", e.message);
  }
  
  try {
    console.log("  stakingVault():", await amm.stakingVault());
  } catch (e: any) {
    console.log("  stakingVault() error:", e.message);
  }
  
  try {
    console.log("  oracle():", await amm.oracle());
  } catch (e: any) {
    console.log("  oracle() error:", e.message);
  }
  
  console.log("\nExpected:");
  console.log("  MIM:", "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708");
  console.log("  StakingVault:", "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7");
}

main().catch(console.error);


