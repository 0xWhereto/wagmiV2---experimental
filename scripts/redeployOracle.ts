/**
 * Redeploy OracleAdapter with correct sWETH/MIM pool
 */

import { ethers } from "hardhat";

const CORRECT_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190"; // NEW sWETH/MIM pool
const TWAP_PERIOD = 1800; // 30 minutes

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying OracleAdapter with:", deployer.address);
  
  // Check the pool
  const pool = new ethers.Contract(CORRECT_POOL, [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
  ], deployer);
  
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const slot0 = await pool.slot0();
  
  console.log("\nPool:", CORRECT_POOL);
  console.log("  token0:", token0, "(sWETH)");
  console.log("  token1:", token1, "(MIM)");
  console.log("  current tick:", slot0[1]);
  
  // Deploy new OracleAdapter
  console.log("\nDeploying OracleAdapter...");
  const OracleAdapter = await ethers.getContractFactory("contracts/0IL/core/OracleAdapter.sol:OracleAdapter");
  const oracle = await OracleAdapter.deploy(
    CORRECT_POOL,
    TWAP_PERIOD
  );
  await oracle.deployed();
  console.log("OracleAdapter deployed:", oracle.address);
  
  // Verify
  const oraclePool = await oracle.pool();
  console.log("\nVerification:");
  console.log("  oracle.pool():", oraclePool);
  
  try {
    const price = await oracle.getPrice();
    console.log("  oracle.getPrice():", ethers.utils.formatEther(price), "MIM per sWETH");
  } catch (e: any) {
    console.log("  getPrice error:", e.reason || e.message?.slice(0, 100));
    console.log("  Note: TWAP may need time to accumulate observations");
  }
  
  // Now we need to update LeverageAMM to use this new oracle
  console.log("\n=== UPDATE REQUIRED ===");
  console.log("Need to redeploy LeverageAMM with new oracle!");
  console.log("New OracleAdapter:", oracle.address);
}

main().catch(console.error);


