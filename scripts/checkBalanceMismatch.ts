import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const SUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== CHECKING BALANCE MISMATCH ===\n");
  
  // Arbitrum
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const usdcArb = new ethers.Contract(USDC_ARB, ["function balanceOf(address) view returns (uint256)"], arbProvider);
  
  const gatewayUSDC = await usdcArb.balanceOf(GATEWAY);
  const userUSDCArb = await usdcArb.balanceOf(USER);
  
  console.log("=== ARBITRUM ===");
  console.log(`Gateway USDC locked: ${ethers.utils.formatUnits(gatewayUSDC, 6)} USDC`);
  console.log(`User USDC balance:   ${ethers.utils.formatUnits(userUSDCArb, 6)} USDC`);
  
  // Sonic
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const sUSDC = new ethers.Contract(SUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], sonicProvider);
  
  const userSUSDC = await sUSDC.balanceOf(USER);
  const totalSUSDC = await sUSDC.totalSupply();
  
  console.log("\n=== SONIC ===");
  console.log(`User sUSDC balance:  ${ethers.utils.formatUnits(userSUSDC, 6)} sUSDC`);
  console.log(`Total sUSDC supply:  ${ethers.utils.formatUnits(totalSUSDC, 6)} sUSDC`);
  
  // Mismatch
  const mismatch = gatewayUSDC.sub(totalSUSDC);
  console.log("\n=== ANALYSIS ===");
  console.log(`Gateway USDC - Total sUSDC = ${ethers.utils.formatUnits(mismatch, 6)}`);
  
  if (mismatch.gt(0)) {
    console.log(`\n⚠️ There is ${ethers.utils.formatUnits(mismatch, 6)} USDC in Gateway with no corresponding sUSDC`);
    console.log("This could be from failed bridge transactions.");
  } else if (mismatch.lt(0)) {
    console.log(`\n⚠️ There is ${ethers.utils.formatUnits(mismatch.abs(), 6)} more sUSDC than USDC locked`);
  } else {
    console.log("\n✅ Balances are matched perfectly");
  }
}

main().catch(console.error);
