/**
 * Create sWETH/MIM pool with the NEW MIM token
 */

import { ethers } from "hardhat";

const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Creating sWETH/MIM pool with:", signer.address);
  
  // Token ordering
  const token0 = SWETH.toLowerCase() < NEW_MIM.toLowerCase() ? SWETH : NEW_MIM;
  const token1 = SWETH.toLowerCase() < NEW_MIM.toLowerCase() ? NEW_MIM : SWETH;
  
  console.log("\nToken ordering:");
  console.log("  Token0:", token0, token0 === SWETH ? "(sWETH)" : "(MIM)");
  console.log("  Token1:", token1, token1 === NEW_MIM ? "(MIM)" : "(sWETH)");
  
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)",
  ], signer);
  
  // Use 0.05% fee (500) for ETH/stablecoin pairs
  const fee = 500;
  
  let poolAddr = await factory.getPool(SWETH, NEW_MIM, fee);
  
  if (poolAddr === ethers.constants.AddressZero) {
    console.log("\nCreating 0.05% fee sWETH/MIM pool...");
    const tx = await factory.createPool(SWETH, NEW_MIM, fee);
    await tx.wait();
    poolAddr = await factory.getPool(SWETH, NEW_MIM, fee);
    console.log("Pool created:", poolAddr);
    
    // Initialize at ~3000 MIM per sWETH
    // If sWETH is token0, MIM is token1: price = MIM/sWETH = 3000
    // sqrtPrice = sqrt(3000) ≈ 54.77
    // sqrtPriceX96 = 54.77 * 2^96
    
    const pool = new ethers.Contract(poolAddr, [
      "function initialize(uint160) external",
      "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
      "function token0() view returns (address)",
    ], signer);
    
    const actualToken0 = await pool.token0();
    console.log("Actual token0:", actualToken0);
    
    // Calculate sqrtPriceX96 for price = 3000
    const Q96 = ethers.BigNumber.from(2).pow(96);
    let sqrtPriceX96;
    
    if (actualToken0.toLowerCase() === SWETH.toLowerCase()) {
      // sWETH is token0, MIM is token1
      // price = MIM/sWETH = 3000 (in terms of 18-decimal tokens)
      // sqrtPrice = sqrt(3000) = 54.77
      sqrtPriceX96 = Q96.mul(5477).div(100);
    } else {
      // MIM is token0, sWETH is token1
      // price = sWETH/MIM = 1/3000 = 0.000333
      // sqrtPrice = sqrt(0.000333) = 0.01826
      sqrtPriceX96 = Q96.mul(1826).div(100000);
    }
    
    console.log("Initializing at sqrtPriceX96:", sqrtPriceX96.toString());
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    
    const slot0 = await pool.slot0();
    console.log("Pool initialized at tick:", slot0[1]);
  } else {
    console.log("\nPool already exists:", poolAddr);
    
    const pool = new ethers.Contract(poolAddr, [
      "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
      "function token0() view returns (address)",
      "function token1() view returns (address)",
    ], signer);
    
    const token0Addr = await pool.token0();
    const token1Addr = await pool.token1();
    const slot0 = await pool.slot0();
    
    console.log("  Token0:", token0Addr);
    console.log("  Token1:", token1Addr);
    console.log("  Current tick:", slot0[1]);
  }
  
  console.log("\n=== Update V3LPVault ===");
  console.log("Pool:", poolAddr);
}

main().catch(console.error);


