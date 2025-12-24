import { ethers } from "hardhat";

const MIM_CONTRACT = "0x9ea06883EE9aA5F93d68fb3E85C4Cf44f4C01073";
const MIM_USDC_POOL = "0x61B0f8EFc07C255681a09ed98d6b47Aa1a194D87";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  console.log("=== Check MIM Pool State ===");
  
  // Check MIM contract state
  const mimABI = [
    "function usdc() view returns (address)",
    "function liquidityPositionId() view returns (uint256)",
    "function totalLiquidity() view returns (uint128)",
    "function TICK_LOWER() view returns (int24)",
    "function TICK_UPPER() view returns (int24)"
  ];
  const mim = await ethers.getContractAt(mimABI, MIM_CONTRACT);
  
  const usdc = await mim.usdc();
  const positionId = await mim.liquidityPositionId();
  const totalLiq = await mim.totalLiquidity();
  const tickLower = await mim.TICK_LOWER();
  const tickUpper = await mim.TICK_UPPER();
  
  console.log("\nMIM Contract:");
  console.log("  USDC address:", usdc);
  console.log("  Position ID:", positionId.toString());
  console.log("  Total Liquidity:", totalLiq.toString());
  console.log("  Tick Range:", tickLower, "to", tickUpper);
  
  // Compare addresses
  console.log("\n  Token ordering:");
  console.log("  USDC:", usdc);
  console.log("  MIM:", MIM_CONTRACT);
  console.log("  USDC < MIM:", usdc.toLowerCase() < MIM_CONTRACT.toLowerCase());
  
  // Check pool state
  const poolABI = [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)"
  ];
  const pool = await ethers.getContractAt(poolABI, MIM_USDC_POOL);
  
  const [sqrtPriceX96, tick] = await pool.slot0();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const poolLiq = await pool.liquidity();
  
  console.log("\nMIM/USDC Pool:");
  console.log("  Token0:", token0);
  console.log("  Token1:", token1);
  console.log("  Current Tick:", tick);
  console.log("  SqrtPriceX96:", sqrtPriceX96.toString());
  console.log("  Pool Liquidity:", poolLiq.toString());
  
  // Check if current tick is in range
  console.log("\n--- Range Analysis ---");
  console.log("  Configured range:", tickLower, "to", tickUpper);
  console.log("  Current tick:", tick);
  
  if (tick < tickLower) {
    console.log("  ⚠️  Current tick is BELOW range!");
    console.log("  -> Only token0 (", token0, ") will be deposited");
  } else if (tick > tickUpper) {
    console.log("  ⚠️  Current tick is ABOVE range!");
    console.log("  -> Only token1 (", token1, ") will be deposited");
  } else {
    console.log("  ✓ Current tick is IN range");
    console.log("  -> Both tokens should be deposited");
  }
  
  // Check sUSDC balance in MIM contract
  const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
  const erc20ABI = ["function balanceOf(address) view returns (uint256)"];
  const usdcToken = await ethers.getContractAt(erc20ABI, sUSDC);
  const mimUsdcBalance = await usdcToken.balanceOf(MIM_CONTRACT);
  console.log("\n  sUSDC stuck in MIM contract:", ethers.utils.formatUnits(mimUsdcBalance, 6));
}

main().catch(console.error);
