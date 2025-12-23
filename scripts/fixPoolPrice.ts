/**
 * Fix MIM/sUSDC Pool Price
 * 
 * The pool was initialized at tick 0 (wrong) but needs to be at ~-276325
 * for a 6/18 decimal pair at 1:1 dollar parity.
 * 
 * Since we can't re-initialize, we'll add liquidity at a wide range
 * then swap to move the price.
 */

import { ethers } from "hardhat";

const POOL = "0xbAf420057E910a6Aacad249FFfa1c63D30BDB87a";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const MIM = "0xd2f90A7a2A1D52FEC8AE4641f811b771A16A6892";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Fixing pool price with:", signer.address);
  
  // Check current pool state
  const pool = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function liquidity() view returns (uint128)",
  ], signer);
  
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const fee = await pool.fee();
  const slot0 = await pool.slot0();
  
  console.log("\nCurrent Pool State:");
  console.log("  Token0:", token0, token0.toLowerCase() === SUSDC.toLowerCase() ? "(sUSDC)" : "(MIM)");
  console.log("  Token1:", token1, token1.toLowerCase() === MIM.toLowerCase() ? "(MIM)" : "(sUSDC)");
  console.log("  Fee:", fee);
  console.log("  Current tick:", slot0.tick);
  console.log("  SqrtPriceX96:", slot0.sqrtPriceX96.toString());
  
  // For sUSDC (6 dec) as token0 and MIM (18 dec) as token1:
  // At 1:1 dollar parity: 1 sUSDC = 1 MIM in dollar terms
  // But in raw terms: 1e6 sUSDC = 1e18 MIM
  // Price = MIM/sUSDC = 1e18/1e6 = 1e12
  // sqrtPrice = sqrt(1e12) = 1e6
  // sqrtPriceX96 = 1e6 * 2^96 = 79228162514264337593543950336 * 1e6
  // Actually: sqrtPriceX96 = sqrt(price) * 2^96
  // For price = 1e12: sqrtPriceX96 = 1e6 * 2^96 ≈ 7.92e31
  
  // The pool was initialized at sqrtPriceX96 for tick 0 (price = 1)
  // We need to move it to tick ~276325 (price = 1e12)
  
  // Since there's no liquidity, we can create a NEW pool with correct price
  // Actually, let's check if we can use a different fee tier
  
  console.log("\n--- Creating new pool with 0.01% fee tier (better for stables) ---");
  
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)",
  ], signer);
  
  // Try 0.01% fee tier (100) - best for stablecoins
  let newPoolAddr = await factory.getPool(SUSDC, MIM, 100);
  
  if (newPoolAddr === ethers.constants.AddressZero) {
    console.log("Creating 0.01% fee pool...");
    const tx = await factory.createPool(SUSDC, MIM, 100);
    await tx.wait();
    newPoolAddr = await factory.getPool(SUSDC, MIM, 100);
    console.log("Created pool:", newPoolAddr);
    
    // Initialize at correct price
    const newPool = new ethers.Contract(newPoolAddr, [
      "function initialize(uint160) external",
    ], signer);
    
    // For sUSDC (6) as token0, MIM (18) as token1
    // price = 1e18/1e6 = 1e12
    // sqrtPrice = 1e6
    // sqrtPriceX96 = 1e6 * 2^96
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceX96 = Q96.mul(1000000); // 1e6 * 2^96
    
    console.log("Initializing at sqrtPriceX96:", sqrtPriceX96.toString());
    const initTx = await newPool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("Pool initialized!");
    
    // Check the tick
    const newPoolRead = new ethers.Contract(newPoolAddr, [
      "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    ], signer);
    const newSlot0 = await newPoolRead.slot0();
    console.log("New pool tick:", newSlot0[1]);
  } else {
    console.log("0.01% pool already exists:", newPoolAddr);
    
    const existingPool = new ethers.Contract(newPoolAddr, [
      "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    ], signer);
    const existingSlot0 = await existingPool.slot0();
    console.log("Existing pool tick:", existingSlot0[1]);
  }
  
  console.log("\n--- Next Step ---");
  console.log("The MIM contract needs to be redeployed to use the new 0.01% pool");
  console.log("Or we need to manually add liquidity to move the 0.3% pool price");
}

main().catch(console.error);
