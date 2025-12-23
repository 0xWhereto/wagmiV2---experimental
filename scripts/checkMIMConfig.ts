import { ethers } from "hardhat";

const MIM = "0xd2f90A7a2A1D52FEC8AE4641f811b771A16A6892"; // New v5

async function main() {
  const [signer] = await ethers.getSigners();
  
  const MIM_ABI = [
    "function usdc() view returns (address)",
    "function mimUsdcPool() view returns (address)",
    "function positionManager() view returns (address)",
  ];
  
  const mim = new ethers.Contract(MIM, MIM_ABI, signer);
  
  const usdc = await mim.usdc();
  const pool = await mim.mimUsdcPool();
  
  console.log("MIM Contract Config:");
  console.log("  USDC backing:", usdc);
  console.log("  MIM/USDC Pool:", pool);
  
  // Check if it's the synthetic or native USDC
  if (usdc.toLowerCase() === "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B".toLowerCase()) {
    console.log("  --> Using SYNTHETIC sUSDC (correct!)");
  } else if (usdc.toLowerCase() === "0x29219dd400f2Bf60E5a23d13Be72B486D4038894".toLowerCase()) {
    console.log("  --> Using NATIVE USDC (wrong - needs redeploy!)");
  } else {
    console.log("  --> Unknown USDC address");
  }
}

main().catch(console.error);

