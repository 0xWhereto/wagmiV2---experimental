/**
 * 0IL Protocol Deployment Fix Script
 *
 * Fixes:
 * - BUG-007: V3LPVault layers not configured
 * - BUG-005: LeverageAMM weekly payment not initialized (if function exists)
 *
 * Run: npx hardhat run scripts/fix0ILDeployment.ts --network sonic
 */

import { ethers } from "hardhat";

const ADDRESSES = {
  V3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  LeverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
};

const V3LP_ABI = [
  "function setDefaultLayers() external",
  "function getLayerCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function operator(address) view returns (bool)",
];

const LEVERAGE_AMM_ABI = [
  "function lastWeeklyPayment() view returns (uint256)",
  "function owner() view returns (address)",
  // Note: initializeWeeklyPayment may not exist on deployed contract
];

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║            0IL PROTOCOL DEPLOYMENT FIX                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Network: Sonic (Chain ID: 146)`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // ============ FIX 1: V3LPVault Layers ============

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FIX 1: V3LPVault Layer Configuration");
  console.log("═══════════════════════════════════════════════════════════\n");

  const v3Vault = new ethers.Contract(ADDRESSES.V3LPVault, V3LP_ABI, deployer);

  try {
    const owner = await v3Vault.owner();
    console.log(`  V3LPVault owner: ${owner}`);
    console.log(`  Current wallet: ${deployer.address}`);

    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
    console.log(`  Is owner: ${isOwner ? "✅ YES" : "❌ NO"}\n`);

    const layersBefore = await v3Vault.getLayerCount();
    console.log(`  Current layer count: ${layersBefore.toString()}`);

    if (layersBefore.toString() === "0") {
      if (isOwner) {
        console.log("  Setting default layers...");
        const tx = await v3Vault.setDefaultLayers({ gasLimit: 500000 });
        console.log(`  Tx submitted: ${tx.hash}`);
        await tx.wait();
        console.log("  ✅ Transaction confirmed!");

        const layersAfter = await v3Vault.getLayerCount();
        console.log(`  New layer count: ${layersAfter.toString()}`);
        console.log("\n  🎉 FIX 1 COMPLETE: V3LPVault layers configured!");
      } else {
        console.log("\n  ⚠️ Cannot fix: Not the owner of V3LPVault");
        console.log(`  Owner address: ${owner}`);
        console.log("  Please run this script with the owner's private key.");
      }
    } else {
      console.log("\n  ℹ️ Layers already configured. No action needed.");
    }
  } catch (e: any) {
    console.log(`\n  ❌ Error checking V3LPVault: ${e.message?.slice(0, 100)}`);
  }

  // ============ FIX 2: LeverageAMM Weekly Payment ============

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  FIX 2: LeverageAMM Weekly Payment Initialization");
  console.log("═══════════════════════════════════════════════════════════\n");

  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, deployer);

  try {
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const owner = await leverageAMM.owner();

    console.log(`  LeverageAMM owner: ${owner}`);
    console.log(`  lastWeeklyPayment: ${lastPayment.toString()}`);

    if (lastPayment.toString() === "0") {
      console.log("  ⚠️ Weekly payment not initialized (value is 0)");
      console.log("\n  NOTE: The deployed contract may not have an initialization function.");
      console.log("  Options to fix:");
      console.log("    1. Call payWeeklyInterest() to set the timestamp (if allowed)");
      console.log("    2. Redeploy LeverageAMM with fixed constructor");
      console.log("    3. Use proxy upgrade pattern");
    } else {
      const date = new Date(lastPayment.toNumber() * 1000);
      console.log(`  Last payment date: ${date.toISOString()}`);
      console.log("\n  ℹ️ Weekly payment already initialized. No action needed.");
    }
  } catch (e: any) {
    console.log(`\n  ❌ Error checking LeverageAMM: ${e.message?.slice(0, 100)}`);
  }

  // ============ VERIFICATION ============

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  VERIFICATION: Post-Fix State Check");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const layerCount = await v3Vault.getLayerCount();
    const isOperator = await v3Vault.operator(ADDRESSES.LeverageAMM);

    console.log(`  V3LPVault layer count: ${layerCount.toString()}`);
    console.log(`  LeverageAMM is operator: ${isOperator ? "✅" : "❌"}`);

    if (layerCount.toString() !== "0" && isOperator) {
      console.log("\n  🎉 V3LPVault is properly configured!");
      console.log("  Deposits should now work.");
    } else {
      if (layerCount.toString() === "0") {
        console.log("\n  ⚠️ Layers still not configured");
      }
      if (!isOperator) {
        console.log("\n  ⚠️ LeverageAMM is not set as operator");
        console.log("  Run: v3Vault.setOperator(LeverageAMM, true)");
      }
    }
  } catch (e: any) {
    console.log(`  ❌ Verification failed: ${e.message?.slice(0, 100)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  FIX SCRIPT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fix script failed:", error);
    process.exit(1);
  });
