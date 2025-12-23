import { ethers } from "hardhat";

const ADDRESSES = {
  SMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  LEVERAGE_AMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508"
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Weekly Interest State Check ===\n");

  // Check StakingVault weekly state
  const vault = new ethers.Contract(ADDRESSES.SMIM, [
    "function weekStartTime() view returns (uint256)",
    "function weeklyExpectedInterest() view returns (uint256)",
    "function weeklyPaidInterest() view returns (uint256)",
    "function isWeekComplete() view returns (bool)",
    "function getWeeklyExpectedInterest() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function borrowRate() view returns (uint256)",
    "function averageUtilization() view returns (uint256)",
    "function utilizationRate() view returns (uint256)",
    "function startNewWeek() external"
  ], signer);

  console.log("--- StakingVault Weekly State ---");
  
  try {
    const weekStart = await vault.weekStartTime();
    const weekStartDate = new Date(Number(weekStart) * 1000);
    const now = Math.floor(Date.now() / 1000);
    const daysSinceStart = (now - Number(weekStart)) / 86400;
    
    console.log("Week Start:", weekStartDate.toISOString());
    console.log("Days Since Start:", daysSinceStart.toFixed(2));
    console.log("Week Initialized:", Number(weekStart) > 0 ? "YES" : "NO (epoch 0)");
  } catch (e: any) {
    console.log("❌ weekStartTime() failed");
  }

  try {
    const isComplete = await vault.isWeekComplete();
    console.log("Is Week Complete:", isComplete);
  } catch (e: any) {
    console.log("❌ isWeekComplete() failed");
  }

  try {
    const expectedInterest = await vault.getWeeklyExpectedInterest();
    console.log("Weekly Expected Interest:", ethers.utils.formatUnits(expectedInterest, 18), "MIM");
  } catch (e: any) {
    console.log("❌ getWeeklyExpectedInterest() failed");
  }

  try {
    const paidInterest = await vault.weeklyPaidInterest();
    console.log("Weekly Paid Interest:", ethers.utils.formatUnits(paidInterest, 18), "MIM");
  } catch (e: any) {
    console.log("❌ weeklyPaidInterest() failed");
  }

  try {
    const totalBorrows = await vault.totalBorrows();
    console.log("Total Borrows:", ethers.utils.formatUnits(totalBorrows, 18), "MIM");
  } catch (e: any) {
    console.log("❌ totalBorrows() failed");
  }

  try {
    const borrowRate = await vault.borrowRate();
    console.log("Annual Borrow Rate:", (Number(borrowRate) / 1e16).toFixed(2), "%");
  } catch (e: any) {
    console.log("❌ borrowRate() failed");
  }

  try {
    const avgUtil = await vault.averageUtilization();
    const currentUtil = await vault.utilizationRate();
    console.log("Current Utilization:", (Number(currentUtil) / 1e16).toFixed(2), "%");
    console.log("7-Day Avg Utilization:", (Number(avgUtil) / 1e16).toFixed(2), "%");
  } catch (e: any) {
    console.log("❌ utilization functions failed");
  }

  // Check LeverageAMM
  console.log("\n--- LeverageAMM State ---");
  const amm = new ethers.Contract(ADDRESSES.LEVERAGE_AMM, [
    "function pendingInterest() view returns (uint256)",
    "function accumulatedFees() view returns (uint256)"
  ], signer);

  try {
    const pending = await amm.pendingInterest();
    console.log("Pending Interest:", ethers.utils.formatUnits(pending, 18), "MIM");
  } catch (e: any) {
    console.log("❌ pendingInterest() - function may not exist");
  }

  try {
    const fees = await amm.accumulatedFees();
    console.log("Accumulated Fees:", ethers.utils.formatUnits(fees, 18), "MIM");
  } catch (e: any) {
    console.log("❌ accumulatedFees() failed");
  }

  // Check if we can start a new week
  console.log("\n--- Weekly Cycle Status ---");
  try {
    const isComplete = await vault.isWeekComplete();
    if (isComplete) {
      console.log("⚠️ Week is complete - should call startNewWeek()");
      
      // Try to start new week
      console.log("\nAttempting to start new week...");
      const tx = await vault.startNewWeek();
      console.log("TX Hash:", tx.hash);
      await tx.wait();
      console.log("✅ New week started successfully!");
    } else {
      console.log("✅ Week is still in progress - no action needed");
    }
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 200));
  }
}

main().catch(console.error);
