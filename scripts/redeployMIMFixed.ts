import { ethers } from "hardhat";

const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const UNISWAP_FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

async function main() {
  console.log("=== Redeploy MIM with Fixed Token Ordering ===\n");
  
  // 1. Deploy new MIM
  console.log("1. Deploying new MIM contract...");
  const MIM = await ethers.getContractFactory("MIM");
  const mim = await MIM.deploy(sUSDC, POSITION_MANAGER);
  await mim.deployed();
  console.log("   MIM deployed to:", mim.address);
  
  // 2. Check token ordering
  const usdcIsToken0 = await mim.usdcIsToken0();
  const tickLower = await mim.TICK_LOWER();
  const tickUpper = await mim.TICK_UPPER();
  console.log("\n2. Token ordering check:");
  console.log("   USDC is token0:", usdcIsToken0);
  console.log("   sUSDC address:", sUSDC);
  console.log("   MIM address:", mim.address);
  console.log("   Tick range:", tickLower, "to", tickUpper);
  
  // 3. Create pool with correct initial price
  console.log("\n3. Creating MIM/sUSDC pool at 0.01% fee...");
  
  const factoryABI = [
    "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  const factory = await ethers.getContractAt(factoryABI, UNISWAP_FACTORY);
  
  // Check if pool already exists
  let poolAddress = await factory.getPool(sUSDC, mim.address, 100);
  
  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    // Create pool
    const tx = await factory.createPool(sUSDC, mim.address, 100);
    await tx.wait();
    poolAddress = await factory.getPool(sUSDC, mim.address, 100);
    console.log("   Pool created:", poolAddress);
  } else {
    console.log("   Pool already exists:", poolAddress);
  }
  
  // 4. Initialize pool with correct price
  console.log("\n4. Initializing pool with correct price...");
  
  const poolABI = [
    "function initialize(uint160 sqrtPriceX96) external",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ];
  const pool = await ethers.getContractAt(poolABI, poolAddress);
  
  // Check if already initialized
  let isInitialized = false;
  try {
    const slot0 = await pool.slot0();
    if (slot0.sqrtPriceX96.gt(0)) {
      console.log("   Pool already initialized at sqrtPriceX96:", slot0.sqrtPriceX96.toString());
      console.log("   Current tick:", slot0.tick);
      isInitialized = true;
    }
  } catch (e) {
    isInitialized = false;
  }
  
  if (!isInitialized) {
    // Need to initialize
    // For 1:1 peg between 6 decimal USDC and 18 decimal MIM:
    // If USDC is token0: price = 1e12, sqrt(1e12) = 1e6, sqrtPriceX96 = 1e6 * 2^96
    // If MIM is token0: price = 1e-12, sqrt(1e-12) = 1e-6, sqrtPriceX96 = 1e-6 * 2^96
    
    let sqrtPriceX96;
    if (usdcIsToken0) {
      // USDC token0, MIM token1: price = 1e12
      // sqrtPriceX96 = sqrt(1e12) * 2^96 = 1e6 * 79228162514264337593543950336
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336").mul(1000000);
    } else {
      // MIM token0, USDC token1: price = 1e-12
      // sqrtPriceX96 = 2^96 / sqrt(1e12) = 2^96 / 1e6
      sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336").div(1000000);
    }
    
    console.log("   Initializing with sqrtPriceX96:", sqrtPriceX96.toString());
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("   Pool initialized!");
  }
  
  // 5. Verify pool state
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const slot0 = await pool.slot0();
  const tick = slot0.tick;
  
  console.log("\n5. Pool state verification:");
  console.log("   Token0:", token0);
  console.log("   Token1:", token1);
  console.log("   Current tick:", tick);
  console.log("   Tick in range:", tick >= tickLower && tick <= tickUpper);
  
  // 6. Set pool in MIM contract
  console.log("\n6. Setting pool in MIM contract...");
  const setPoolTx = await mim.setPool(poolAddress);
  await setPoolTx.wait();
  console.log("   Pool set!");
  
  // 7. Print summary
  console.log("\n=== SUMMARY ===");
  console.log("NEW MIM Address:", mim.address);
  console.log("NEW MIM/sUSDC Pool:", poolAddress);
  console.log("Token ordering:", usdcIsToken0 ? "USDC=token0, MIM=token1" : "MIM=token0, USDC=token1");
  console.log("Current tick:", tick);
  console.log("Tick range:", tickLower, "to", tickUpper);
  console.log("Tick in range:", tick >= tickLower && tick <= tickUpper ? "✓ YES" : "✗ NO");
  
  console.log("\n=== UPDATE THESE ADDRESSES ===");
  console.log("MIM:", mim.address);
  console.log("MIM/sUSDC Pool:", poolAddress);
}

main().catch(console.error);
