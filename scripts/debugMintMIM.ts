import { ethers } from "hardhat";

const MIM = "0xd2f90A7a2A1D52FEC8AE4641f811b771A16A6892";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);
  
  // Check sUSDC balance
  const sUSDC = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)",
  ], signer);
  
  const balance = await sUSDC.balanceOf(signer.address);
  const decimals = await sUSDC.decimals();
  const allowance = await sUSDC.allowance(signer.address, MIM);
  
  console.log("\nsUSDC:");
  console.log("  Balance:", ethers.utils.formatUnits(balance, decimals));
  console.log("  Allowance for MIM:", ethers.utils.formatUnits(allowance, decimals));
  
  // Check MIM contract state
  const mim = new ethers.Contract(MIM, [
    "function usdc() view returns (address)",
    "function mimUsdcPool() view returns (address)",
    "function liquidityPositionId() view returns (uint256)",
    "function TICK_LOWER() view returns (int24)",
    "function TICK_UPPER() view returns (int24)",
  ], signer);
  
  const usdcAddr = await mim.usdc();
  const pool = await mim.mimUsdcPool();
  const positionId = await mim.liquidityPositionId();
  
  console.log("\nMIM Contract:");
  console.log("  USDC address:", usdcAddr);
  console.log("  Pool:", pool);
  console.log("  Position ID:", positionId.toString());
  
  try {
    const tickLower = await mim.TICK_LOWER();
    const tickUpper = await mim.TICK_UPPER();
    console.log("  Tick range:", tickLower, "to", tickUpper);
  } catch (e) {
    console.log("  Tick range: (not available)");
  }
  
  // Check pool state
  const poolContract = new ethers.Contract(pool, [
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)",
  ], signer);
  
  try {
    const token0 = await poolContract.token0();
    const token1 = await poolContract.token1();
    const slot0 = await poolContract.slot0();
    const liquidity = await poolContract.liquidity();
    
    console.log("\nPool State:");
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("  Current tick:", slot0[1]);
    console.log("  Liquidity:", liquidity.toString());
    
    // The MIM contract's TICK_LOWER and TICK_UPPER are for 18/6 decimal pair
    // Check if current tick is in range
    console.log("\n  Issue: Pool tick is", slot0[1], "but MIM expects ticks around -276000");
    console.log("  The pool needs to be initialized at correct price first!");
  } catch (e: any) {
    console.log("\nPool error:", e.message);
  }
  
  // Try to simulate the mint
  console.log("\n--- Simulating mintWithUSDC ---");
  
  const mimWrite = new ethers.Contract(MIM, [
    "function mintWithUSDC(uint256) external",
  ], signer);
  
  // First approve
  if (allowance.lt(balance)) {
    console.log("Approving sUSDC...");
    const approveTx = await sUSDC.approve(MIM, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("Approved!");
  }
  
  // Try with small amount
  const testAmount = ethers.utils.parseUnits("1", 6); // 1 sUSDC
  
  try {
    // Static call to simulate
    await mimWrite.callStatic.mintWithUSDC(testAmount);
    console.log("Simulation succeeded! Mint should work.");
  } catch (e: any) {
    console.log("Simulation failed:", e.message);
    if (e.reason) console.log("Reason:", e.reason);
    if (e.error?.message) console.log("Error:", e.error.message);
  }
}

main().catch(console.error);

