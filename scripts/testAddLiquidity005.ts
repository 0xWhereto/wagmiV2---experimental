import { ethers } from "hardhat";

const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
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
  
  // Use 0.05% pool (correct price)
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, signer);
  const poolAddr = await factory.getPool(MIM, SWETH, 500);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  const slot0 = await pool.slot0();
  
  console.log("\n0.05% Pool:", poolAddr);
  console.log("Current tick:", slot0.tick);
  
  const currentTick = slot0.tick; // -80201
  
  // For single-sided sWETH (token1), we need tickLower and tickUpper > currentTick
  // Current tick is -80201
  // Higher tick = higher sWETH/MIM price = lower MIM/sWETH price
  // E.g., tick -75000 corresponds to lower MIM/sWETH price (like 2000 instead of 3040)
  
  const tickSpacing = 10; // 0.05% fee = 10 tick spacing
  
  // For single-sided sWETH: range must be ABOVE current tick
  // tickLower > currentTick (-80201)
  const tickLower = nearestUsableTick(-78000, tickSpacing); // Price ~2200 MIM/sWETH
  const tickUpper = nearestUsableTick(-73000, tickSpacing); // Price ~1450 MIM/sWETH
  
  console.log("\nTick range for single-sided sWETH:");
  console.log("  Current tick:", currentTick);
  console.log("  tickLower:", tickLower, "(> currentTick?", tickLower > currentTick, ")");
  console.log("  tickUpper:", tickUpper, "(> currentTick?", tickUpper > currentTick, ")");
  
  // Both ticks must be > currentTick for single-sided token1
  if (tickLower <= currentTick || tickUpper <= currentTick) {
    console.log("ERROR: Ticks not above current tick for single-sided sWETH!");
    return;
  }
  
  // Check balances
  const sweth = new ethers.Contract(SWETH, ERC20_ABI, signer);
  const mim = new ethers.Contract(MIM, ERC20_ABI, signer);
  
  const swethBalance = await sweth.balanceOf(signer.address);
  const mimBalance = await mim.balanceOf(signer.address);
  
  console.log("\nBalances:");
  console.log("  sWETH:", ethers.utils.formatEther(swethBalance));
  console.log("  MIM:", ethers.utils.formatUnits(mimBalance, 18));
  
  // Use larger test amount
  const testAmount = ethers.utils.parseEther("0.004"); // 0.004 sWETH (most of balance)
  
  if (swethBalance.lt(testAmount)) {
    console.log("Insufficient sWETH balance!");
    return;
  }
  
  console.log("\nTest amount (sWETH):", ethers.utils.formatEther(testAmount));
  
  // For single-sided sWETH (token1), amount0Desired should be 0
  const amount0Desired = 0;
  const amount1Desired = testAmount;
  
  console.log("\nMint params:");
  console.log("  token0 (MIM):", MIM);
  console.log("  token1 (sWETH):", SWETH);
  console.log("  fee:", 500);
  console.log("  tickLower:", tickLower);
  console.log("  tickUpper:", tickUpper);
  console.log("  amount0Desired (MIM):", 0);
  console.log("  amount1Desired (sWETH):", ethers.utils.formatEther(amount1Desired));
  
  // Approve
  console.log("\nApproving sWETH...");
  const approveTx = await sweth.approve(POSITION_MANAGER, testAmount);
  await approveTx.wait();
  console.log("Approved!");
  
  // Mint
  const pm = new ethers.Contract(POSITION_MANAGER, PM_ABI, signer);
  
  console.log("\nMinting position...");
  try {
    const mintTx = await pm.mint({
      token0: MIM,
      token1: SWETH,
      fee: 500,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0Desired,
      amount1Desired: amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 3600
    }, { gasLimit: 500000 });
    
    console.log("Tx hash:", mintTx.hash);
    const receipt = await mintTx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.log("Error:", error.message);
    if (error.reason) console.log("Reason:", error.reason);
    if (error.error?.message) console.log("Inner error:", error.error.message);
  }
}

main().catch(console.error);

