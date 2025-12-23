import { ethers } from "hardhat";

const MIM = "0x1590da8C11431eFe1cB42Acfd8A500A5bdb7B1A2";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const V3_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

// Use 0.05% fee tier (500) - unused for this pair
const FEE = 500;

async function main() {
  console.log("===========================================");
  console.log("Test Add Liquidity - sWETH/MIM Pool");
  console.log("===========================================\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  // Check balances
  const mimBal = await mim.balanceOf(signer.address);
  const swethBal = await sweth.balanceOf(signer.address);
  console.log("\nBalances:");
  console.log("  MIM:", ethers.utils.formatUnits(mimBal, 18));
  console.log("  sWETH:", ethers.utils.formatUnits(swethBal, 18));

  // Token ordering
  console.log("\n=== Token Ordering ===");
  const token0 = MIM.toLowerCase() < SWETH.toLowerCase() ? MIM : SWETH;
  const token1 = MIM.toLowerCase() < SWETH.toLowerCase() ? SWETH : MIM;
  console.log("token0:", token0, token0 === MIM ? "(MIM)" : "(sWETH)");
  console.log("token1:", token1, token1 === MIM ? "(MIM)" : "(sWETH)");
  
  // For sorted (MIM, sWETH):
  // price = token1/token0 = sWETH/MIM
  // We want 1 sWETH = 3040 MIM
  // So price = 1/3040 = 0.000329 sWETH per MIM
  const price = 1 / 3040;
  console.log("\nTarget price (sWETH per MIM):", price);
  console.log("This means 1 sWETH = 3040 MIM");

  // Calculate sqrtPriceX96
  // sqrtPriceX96 = sqrt(price) * 2^96
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPrice = Math.sqrt(price);
  const sqrtPriceX96 = ethers.BigNumber.from(
    Math.floor(sqrtPrice * parseFloat(Q96.toString())).toLocaleString('fullwide', {useGrouping: false})
  );
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());

  // Calculate tick
  // tick = log(price) / log(1.0001)
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  console.log("Current tick for price:", tick);

  // Check if pool exists at this fee tier
  const factory = await ethers.getContractAt(
    ["function getPool(address,address,uint24) view returns (address)"],
    V3_FACTORY
  );
  let poolAddress = await factory.getPool(token0, token1, FEE);
  console.log("\n=== Pool Check ===");
  console.log("Pool at", FEE/10000*100, "% fee:", poolAddress);

  const positionManager = await ethers.getContractAt([
    "function createAndInitializePoolIfNecessary(address,address,uint24,uint160) external payable returns (address)",
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256,uint128,uint256,uint256)"
  ], POSITION_MANAGER);

  // Create pool if needed
  if (poolAddress === ethers.constants.AddressZero) {
    console.log("\nCreating pool with correct price...");
    const createTx = await positionManager.createAndInitializePoolIfNecessary(
      token0, token1, FEE, sqrtPriceX96
    );
    await createTx.wait();
    poolAddress = await factory.getPool(token0, token1, FEE);
    console.log("Pool created:", poolAddress);
  }

  // Verify pool state
  const pool = await ethers.getContractAt([
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function tickSpacing() view returns (int24)"
  ], poolAddress);
  const slot0 = await pool.slot0();
  const tickSpacing = await pool.tickSpacing();
  console.log("\nPool state:");
  console.log("  Current tick:", slot0[1]);
  console.log("  Tick spacing:", tickSpacing);

  // Calculate tick range (±50% = "Normal" mode)
  // Current price = 0.000329 sWETH/MIM
  // Min price = 0.5 * 0.000329 = 0.000165 (tick lower)
  // Max price = 1.5 * 0.000329 = 0.000494 (tick higher)
  const minPrice = price * 0.5;
  const maxPrice = price * 1.5;
  
  let tickLower = Math.floor(Math.log(minPrice) / Math.log(1.0001));
  let tickUpper = Math.ceil(Math.log(maxPrice) / Math.log(1.0001));
  
  // Round to tick spacing
  tickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  tickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;
  
  console.log("\nTick range:");
  console.log("  tickLower:", tickLower, "(price:", Math.pow(1.0001, tickLower).toFixed(8), ")");
  console.log("  tickUpper:", tickUpper, "(price:", Math.pow(1.0001, tickUpper).toFixed(8), ")");
  console.log("  Current tick in range:", slot0[1] >= tickLower && slot0[1] < tickUpper);

  // Amounts: 1 MIM and proportional sWETH
  // At price 0.000329 sWETH/MIM, 1 MIM needs ~0.000329 sWETH
  const amount0 = ethers.utils.parseUnits("1", 18); // 1 MIM
  const amount1 = ethers.utils.parseUnits("0.0003", 18); // ~0.0003 sWETH
  
  console.log("\nAmounts to deposit:");
  console.log("  amount0 (MIM):", ethers.utils.formatUnits(amount0, 18));
  console.log("  amount1 (sWETH):", ethers.utils.formatUnits(amount1, 18));

  // Check if we have enough
  if (mimBal.lt(amount0)) {
    console.log("\n❌ Not enough MIM!");
    return;
  }
  if (swethBal.lt(amount1)) {
    console.log("\n❌ Not enough sWETH!");
    return;
  }

  // Approve
  console.log("\n1. Approving tokens...");
  await (await mim.approve(POSITION_MANAGER, amount0)).wait();
  await (await sweth.approve(POSITION_MANAGER, amount1)).wait();
  console.log("   ✅ Approved");

  // Mint position
  console.log("\n2. Minting position...");
  const deadline = Math.floor(Date.now() / 1000) + 600;
  
  const mintParams = {
    token0: token0,
    token1: token1,
    fee: FEE,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer.address,
    deadline: deadline,
  };
  
  console.log("   Mint params:", JSON.stringify({
    ...mintParams,
    amount0Desired: ethers.utils.formatUnits(mintParams.amount0Desired, 18),
    amount1Desired: ethers.utils.formatUnits(mintParams.amount1Desired, 18),
  }, null, 2));

  try {
    const tx = await positionManager.mint(mintParams);
    const receipt = await tx.wait();
    console.log("   ✅ Success! Tx:", receipt.transactionHash);
  } catch (error: any) {
    console.log("   ❌ Failed:", error.message?.slice(0, 200));
  }
}

main().catch(console.error);

