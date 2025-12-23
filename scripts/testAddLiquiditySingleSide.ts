import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const PM_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
];

function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  // Check both pools
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, signer);
  
  console.log("\n=== Checking pools ===");
  for (const fee of [500, 3000]) {
    const poolAddr = await factory.getPool(MIM, SWETH, fee);
    if (poolAddr !== ethers.constants.AddressZero) {
      const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
      const slot0 = await pool.slot0();
      console.log(`\nFee ${fee/10000}%: ${poolAddr}`);
      console.log(`  Current tick: ${slot0.tick}`);
      
      const Q96 = ethers.BigNumber.from(2).pow(96);
      const sqrtPriceNum = parseFloat(slot0.sqrtPriceX96.toString()) / parseFloat(Q96.toString());
      const rawPrice = sqrtPriceNum * sqrtPriceNum;
      console.log(`  Raw price (sWETH/MIM): ${rawPrice}`);
      console.log(`  Inverted (MIM/sWETH): ${1/rawPrice}`);
    }
  }
  
  // Try to add liquidity to 0.3% pool with single-sided sWETH
  console.log("\n=== Testing single-sided sWETH on 0.3% pool ===");
  
  const poolAddr = await factory.getPool(MIM, SWETH, 3000);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  const slot0 = await pool.slot0();
  const currentTick = slot0.tick;
  
  console.log("Current tick:", currentTick);
  
  // For single-sided token1 (sWETH), we need tickLower > currentTick
  // Let's try a range above current tick
  const tickSpacing = 60; // 0.3% fee = 60 tick spacing
  
  // Current tick is 80200
  // For single-sided sWETH: tickLower and tickUpper must be > currentTick
  const tickLower = nearestUsableTick(currentTick + 1000, tickSpacing); // Above current
  const tickUpper = nearestUsableTick(currentTick + 5000, tickSpacing); // Further above
  
  console.log("Tick range for single-sided sWETH:");
  console.log("  tickLower:", tickLower, "(> currentTick", currentTick, "?", tickLower > currentTick, ")");
  console.log("  tickUpper:", tickUpper);
  
  // Check sWETH balance
  const sweth = new ethers.Contract(SWETH, ERC20_ABI, signer);
  const mim = new ethers.Contract(MIM, ERC20_ABI, signer);
  
  const swethBalance = await sweth.balanceOf(signer.address);
  const mimBalance = await mim.balanceOf(signer.address);
  
  console.log("\nBalances:");
  console.log("  sWETH:", ethers.utils.formatEther(swethBalance));
  console.log("  MIM:", ethers.utils.formatUnits(mimBalance, 18));
  
  if (swethBalance.eq(0)) {
    console.log("\nNo sWETH balance to test with!");
    return;
  }
  
  // Use a small amount for testing
  const testAmount = swethBalance.div(10); // 10% of balance
  console.log("\nTest amount (sWETH):", ethers.utils.formatEther(testAmount));
  
  // For single-sided sWETH (token1), amount0Desired should be 0
  // MIM is token0, sWETH is token1
  const amount0Desired = 0;
  const amount1Desired = testAmount;
  
  console.log("\nMint params:");
  console.log("  token0 (MIM):", MIM);
  console.log("  token1 (sWETH):", SWETH);
  console.log("  fee:", 3000);
  console.log("  tickLower:", tickLower);
  console.log("  tickUpper:", tickUpper);
  console.log("  amount0Desired (MIM):", amount0Desired);
  console.log("  amount1Desired (sWETH):", ethers.utils.formatEther(amount1Desired));
  
  // Approve
  const pm = new ethers.Contract(POSITION_MANAGER, PM_ABI, signer);
  
  console.log("\nApproving sWETH...");
  const approveTx = await sweth.approve(POSITION_MANAGER, amount1Desired);
  await approveTx.wait();
  console.log("Approved!");
  
  // Mint
  console.log("\nMinting position...");
  try {
    const mintTx = await pm.mint({
      token0: MIM,
      token1: SWETH,
      fee: 3000,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0Desired,
      amount1Desired: amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 3600
    });
    
    console.log("Tx hash:", mintTx.hash);
    const receipt = await mintTx.wait();
    console.log("Success! Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.log("Error:", error.message);
    if (error.reason) console.log("Reason:", error.reason);
  }
}

main().catch(console.error);

