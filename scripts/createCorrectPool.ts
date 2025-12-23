/**
 * Create MIM/sUSDC pool with the NEW MIM token address
 */

import { ethers } from "hardhat";

const FACTORY = "0x3a1713B6C3734cfC883A3897647f3128Fe789f39";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const NEW_MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Creating pool with account:", signer.address);
  
  // Verify token ordering
  const token0 = SUSDC.toLowerCase() < NEW_MIM.toLowerCase() ? SUSDC : NEW_MIM;
  const token1 = SUSDC.toLowerCase() < NEW_MIM.toLowerCase() ? NEW_MIM : SUSDC;
  
  console.log("\nToken ordering:");
  console.log("  Token0:", token0, token0 === SUSDC ? "(sUSDC - 6 dec)" : "(MIM - 18 dec)");
  console.log("  Token1:", token1, token1 === NEW_MIM ? "(MIM - 18 dec)" : "(sUSDC - 6 dec)");
  
  const factory = new ethers.Contract(FACTORY, [
    "function createPool(address,address,uint24) returns (address)",
    "function getPool(address,address,uint24) view returns (address)",
  ], signer);
  
  // Use 0.01% fee tier (100)
  const fee = 100;
  
  let poolAddr = await factory.getPool(SUSDC, NEW_MIM, fee);
  
  if (poolAddr === ethers.constants.AddressZero) {
    console.log("\nCreating new 0.01% pool...");
    const tx = await factory.createPool(SUSDC, NEW_MIM, fee);
    await tx.wait();
    poolAddr = await factory.getPool(SUSDC, NEW_MIM, fee);
    console.log("Pool created:", poolAddr);
  } else {
    console.log("\nPool already exists:", poolAddr);
  }
  
  // Initialize at correct price
  const pool = new ethers.Contract(poolAddr, [
    "function initialize(uint160) external",
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
  ], signer);
  
  const actualToken0 = await pool.token0();
  const actualToken1 = await pool.token1();
  
  console.log("\nPool tokens:");
  console.log("  Token0:", actualToken0);
  console.log("  Token1:", actualToken1);
  
  // Check if already initialized
  try {
    const slot0 = await pool.slot0();
    if (slot0[0].toString() !== "0") {
      console.log("\nPool already initialized at tick:", slot0[1]);
    } else {
      throw new Error("Not initialized");
    }
  } catch {
    console.log("\nInitializing pool...");
    
    // For sUSDC (6) as token0, MIM (18) as token1:
    // price = MIM/sUSDC = 1e18/1e6 = 1e12
    // sqrtPrice = sqrt(1e12) = 1e6
    // sqrtPriceX96 = 1e6 * 2^96
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceX96 = Q96.mul(1000000);
    
    console.log("  sqrtPriceX96:", sqrtPriceX96.toString());
    
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log("Initialized!");
    
    const slot0 = await pool.slot0();
    console.log("  Current tick:", slot0[1]);
  }
  
  // Set this pool on the MIM contract
  console.log("\n--- Setting pool on MIM contract ---");
  const mim = new ethers.Contract(NEW_MIM, [
    "function setPool(address) external",
    "function mimUsdcPool() view returns (address)",
  ], signer);
  
  const currentPool = await mim.mimUsdcPool();
  if (currentPool.toLowerCase() !== poolAddr.toLowerCase()) {
    console.log("Updating pool from", currentPool, "to", poolAddr);
    const setTx = await mim.setPool(poolAddr);
    await setTx.wait();
    console.log("Pool updated!");
  } else {
    console.log("Pool already set correctly");
  }
  
  console.log("\n=== Final Configuration ===");
  console.log("MIM:", NEW_MIM);
  console.log("Pool:", poolAddr);
  
  // Test mint
  console.log("\n--- Testing mintWithUSDC ---");
  const sUSDC = new ethers.Contract(SUSDC, [
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  await (await sUSDC.approve(NEW_MIM, ethers.constants.MaxUint256)).wait();
  
  const mimWrite = new ethers.Contract(NEW_MIM, [
    "function mintWithUSDC(uint256) external",
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  try {
    const tx = await mimWrite.mintWithUSDC(ethers.utils.parseUnits("1", 6), { gasLimit: 1000000 });
    await tx.wait();
    console.log("Mint succeeded!");
    
    const mimBal = await mimWrite.balanceOf(signer.address);
    console.log("MIM balance:", ethers.utils.formatEther(mimBal));
  } catch (e: any) {
    console.log("Mint failed:", e.reason || e.message);
    
    // Try static call for better error
    try {
      await mimWrite.callStatic.mintWithUSDC(ethers.utils.parseUnits("1", 6));
    } catch (e2: any) {
      console.log("Static call error:", e2.reason || e2.error?.message || e2.message);
    }
  }
}

main().catch(console.error);
