import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const POOL = "0x02591d9503e33E93e6d3AfE47907f1357C336729";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Check pool state
  const pool = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function tickSpacing() view returns (int24)",
    "function liquidity() view returns (uint128)",
  ], signer);
  
  const slot0 = await pool.slot0();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const tickSpacing = await pool.tickSpacing();
  const liquidity = await pool.liquidity();
  
  console.log("Pool State:");
  console.log("  Token0:", token0);
  console.log("  Token1:", token1);
  console.log("  Current tick:", slot0[1]);
  console.log("  Tick spacing:", tickSpacing);
  console.log("  SqrtPriceX96:", slot0[0].toString());
  console.log("  Liquidity:", liquidity.toString());
  
  // Check MIM contract
  const mim = new ethers.Contract(MIM, [
    "function TICK_LOWER() view returns (int24)",
    "function TICK_UPPER() view returns (int24)",
    "function POOL_FEE() view returns (uint24)",
    "function liquidityPositionId() view returns (uint256)",
    "function usdc() view returns (address)",
    "function mimUsdcPool() view returns (address)",
  ], signer);
  
  const tickLower = await mim.TICK_LOWER();
  const tickUpper = await mim.TICK_UPPER();
  const poolFee = await mim.POOL_FEE();
  const posId = await mim.liquidityPositionId();
  const usdcAddr = await mim.usdc();
  const poolAddr = await mim.mimUsdcPool();
  
  console.log("\nMIM Contract:");
  console.log("  USDC:", usdcAddr);
  console.log("  Pool:", poolAddr);
  console.log("  POOL_FEE:", poolFee);
  console.log("  TICK_LOWER:", tickLower);
  console.log("  TICK_UPPER:", tickUpper);
  console.log("  Position ID:", posId.toString());
  
  // Check if current tick is in range
  const currentTick = slot0[1];
  const inRange = currentTick >= tickLower && currentTick <= tickUpper;
  console.log("\nTick Analysis:");
  console.log(`  Current tick ${currentTick} in range [${tickLower}, ${tickUpper}]: ${inRange}`);
  
  // For 0.01% fee, tick spacing is 1, so ticks don't need to be multiples
  // But current tick 276324 IS in range [275700, 276900], so that's fine
  
  // Check if position manager is approved
  const sUSDC = new ethers.Contract(SUSDC, [
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const allowance = await sUSDC.allowance(signer.address, MIM);
  const balance = await sUSDC.balanceOf(signer.address);
  
  console.log("\nsUSDC:");
  console.log("  Balance:", ethers.utils.formatUnits(balance, 6));
  console.log("  Allowance for MIM:", ethers.utils.formatUnits(allowance, 6));
  
  // Check if MIM has approved position manager
  const mimToken = new ethers.Contract(MIM, [
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
  
  const mimAllowance = await sUSDC.allowance(MIM, POSITION_MANAGER);
  console.log("  sUSDC allowance from MIM to PositionManager:", ethers.utils.formatUnits(mimAllowance, 6));
  
  // Try static call
  console.log("\n--- Static call test ---");
  const mimWrite = new ethers.Contract(MIM, [
    "function mintWithUSDC(uint256) external",
  ], signer);
  
  try {
    await mimWrite.callStatic.mintWithUSDC(ethers.utils.parseUnits("1", 6));
    console.log("Static call succeeded!");
  } catch (e: any) {
    console.log("Static call failed:", e.reason || e.message);
  }
}

main().catch(console.error);


