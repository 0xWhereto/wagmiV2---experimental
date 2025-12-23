import { ethers } from "hardhat";

// v7 vault - we're the owner so we can rescue
const V7_WETH = "0xB96651342aE83BfCf509659D16Fd41712B0c58b3";
const V7_LEVERAGE_AMM = "0xF42441EBdc79D15252fBa87Df7682FA543a508A6";
const V7_V3LP_VAULT = "0xd612B7C469b246bE3Ee736205bD22eE260Cb4540";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const OLD_MIM = "0xd2f90A7a2A1D52FEC8AE4641f811b771A16A6892"; // Old MIM token

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Rescuing with:", signer.address);
  
  // Check V3LPVault state
  const v3LPVault = new ethers.Contract(V7_V3LP_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function getLayerCount() view returns (uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    "function owner() view returns (address)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function pool() view returns (address)",
  ], signer);
  
  console.log("\nV3LPVault:", V7_V3LP_VAULT);
  console.log("  Owner:", await v3LPVault.owner());
  console.log("  Token0:", await v3LPVault.token0());
  console.log("  Token1:", await v3LPVault.token1());
  console.log("  Pool:", await v3LPVault.pool());
  
  const [amount0, amount1] = await v3LPVault.getTotalAssets();
  console.log("\n  Total assets:");
  console.log("    Amount0:", ethers.utils.formatEther(amount0));
  console.log("    Amount1:", ethers.utils.formatEther(amount1));
  
  const layerCount = await v3LPVault.getLayerCount();
  console.log("\n  Layers:", layerCount.toString());
  
  for (let i = 0; i < layerCount.toNumber() && i < 5; i++) {
    const layer = await v3LPVault.layers(i);
    console.log(`    Layer ${i}: tokenId=${layer[3]}, liquidity=${layer[4].toString()}`);
  }
  
  // Check LeverageAMM
  console.log("\nLeverageAMM:", V7_LEVERAGE_AMM);
  const leverageAMM = new ethers.Contract(V7_LEVERAGE_AMM, [
    "function owner() view returns (address)",
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function mim() view returns (address)",
    "function underlyingAsset() view returns (address)",
    "function stakingVault() view returns (address)",
    "function emergencyDeleverage() external",
  ], signer);
  
  console.log("  Owner:", await leverageAMM.owner());
  console.log("  MIM:", await leverageAMM.mim());
  console.log("  Underlying:", await leverageAMM.underlyingAsset());
  console.log("  StakingVault:", await leverageAMM.stakingVault());
  console.log("  Total debt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("  Total underlying:", ethers.utils.formatEther(await leverageAMM.totalUnderlying()));
  
  // Check what MIM is used
  const mimAddr = await leverageAMM.mim();
  console.log("\n  MIM contract:", mimAddr);
  console.log("  Is OLD MIM:", mimAddr.toLowerCase() === OLD_MIM.toLowerCase());
  console.log("  Is NEW MIM:", mimAddr.toLowerCase() === MIM.toLowerCase());
  
  // Check sWETH balance in LeverageAMM
  const sWETH = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const ammSWETHBalance = await sWETH.balanceOf(V7_LEVERAGE_AMM);
  console.log("\n  sWETH in LeverageAMM:", ethers.utils.formatEther(ammSWETHBalance));
  
  // Check if we can rescue by calling emergency functions
  console.log("\n=== RESCUE OPTIONS ===");
  console.log("1. Owner can call emergencyDeleverage() on LeverageAMM");
  console.log("2. Need to check if there's any sWETH left to recover");
}

main().catch(console.error);

