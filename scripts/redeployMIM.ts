/**
 * Redeploy MIM with correct tick values
 */

import { ethers } from "hardhat";

const EXISTING = {
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  stakingVault: "0xC40c55fC2395Deb4E9179eC89768516b90C36cf7", // Keep existing
  leverageAMM: "0x9D21e8585cD05334F1E41b37CCEd3eD1923D0Fef", // Keep existing
  correctPool: "0x02591d9503e33E93e6d3AfE47907f1357C336729", // 0.01% pool at correct tick
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying MIM with:", deployer.address);
  
  // Deploy new MIM
  console.log("\nDeploying MIM with correct tick values...");
  const MIM = await ethers.getContractFactory("contracts/0IL/core/MIM.sol:MIM");
  const mim = await MIM.deploy(
    EXISTING.sUSDC,
    EXISTING.positionManager
  );
  await mim.deployed();
  console.log("MIM deployed to:", mim.address);
  
  // Set the correct pool
  console.log("\nSetting pool...");
  await (await mim.setPool(EXISTING.correctPool)).wait();
  console.log("Pool set to:", EXISTING.correctPool);
  
  // Check the tick values
  const tickLower = await mim.TICK_LOWER();
  const tickUpper = await mim.TICK_UPPER();
  const poolFee = await mim.POOL_FEE();
  console.log("\nMIM Contract Config:");
  console.log("  POOL_FEE:", poolFee);
  console.log("  TICK_LOWER:", tickLower);
  console.log("  TICK_UPPER:", tickUpper);
  
  // Set LeverageAMM as minter
  console.log("\nSetting LeverageAMM as minter...");
  await (await mim.setMinter(EXISTING.leverageAMM, ethers.constants.MaxUint256)).wait();
  console.log("Done!");
  
  console.log("\n=== Update Frontend ===");
  console.log(`mim: "${mim.address}",`);
  console.log(`mimUsdcPool: "${EXISTING.correctPool}",`);
  
  // Test mint
  console.log("\n=== Testing mintWithUSDC ===");
  
  const sUSDC = new ethers.Contract(EXISTING.sUSDC, [
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], deployer);
  
  const balance = await sUSDC.balanceOf(deployer.address);
  console.log("sUSDC balance:", ethers.utils.formatUnits(balance, 6));
  
  if (balance.gt(0)) {
    // Approve
    await (await sUSDC.approve(mim.address, ethers.constants.MaxUint256)).wait();
    console.log("Approved sUSDC");
    
    // Try minting 1 sUSDC
    const testAmount = ethers.utils.parseUnits("1", 6);
    try {
      const tx = await mim.mintWithUSDC(testAmount, { gasLimit: 1000000 });
      await tx.wait();
      console.log("Mint succeeded!");
      
      const mimBalance = await mim.balanceOf(deployer.address);
      console.log("MIM balance:", ethers.utils.formatEther(mimBalance));
    } catch (e: any) {
      console.log("Mint failed:", e.message);
    }
  }
}

main().catch(console.error);
