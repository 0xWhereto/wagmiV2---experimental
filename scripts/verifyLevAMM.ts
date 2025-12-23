import { ethers } from "hardhat";

const LEVERAGE_AMM = "0x89e62a3f33c5046138DF8A0DfF7fF2AC3e180098";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Verify LeverageAMM Configuration ===\n");
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function mim() view returns (address)",
    "function underlyingAsset() view returns (address)",
    "function v3LPVault() view returns (address)",
    "function stakingVault() view returns (address)",
    "function oracle() view returns (address)",
    "function wToken() view returns (address)",
    "function underlyingIsToken0() view returns (bool)"
  ], signer);
  
  console.log("LeverageAMM.mim():", await leverageAMM.mim());
  console.log("Expected MIM:", MIM);
  console.log("Match:", (await leverageAMM.mim()).toLowerCase() === MIM.toLowerCase());
  
  console.log("\nLeverageAMM.underlyingAsset():", await leverageAMM.underlyingAsset());
  console.log("Expected SWETH:", SWETH);
  console.log("Match:", (await leverageAMM.underlyingAsset()).toLowerCase() === SWETH.toLowerCase());
  
  console.log("\nLeverageAMM.underlyingIsToken0():", await leverageAMM.underlyingIsToken0());
  console.log("Expected (SWETH < MIM):", SWETH.toLowerCase() < MIM.toLowerCase());
  
  console.log("\nLeverageAMM.v3LPVault():", await leverageAMM.v3LPVault());
  console.log("LeverageAMM.stakingVault():", await leverageAMM.stakingVault());
  console.log("LeverageAMM.oracle():", await leverageAMM.oracle());
  console.log("LeverageAMM.wToken():", await leverageAMM.wToken());
}
main().catch(console.error);
