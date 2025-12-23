import { ethers } from "hardhat";

const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Simulating Withdrawal Flow ===\n");

  // Step 1: Check wETH vault state
  const weth = new ethers.Contract(WETH_VAULT, [
    "function totalSupply() view returns (uint256)",
    "function leverageAMM() view returns (address)"
  ], signer);

  const totalSupply = await weth.totalSupply();
  console.log("wETH Total Supply:", ethers.utils.formatUnits(totalSupply, 18));

  let leverageAMMAddr;
  try {
    leverageAMMAddr = await weth.leverageAMM();
    console.log("wETH.leverageAMM():", leverageAMMAddr);
  } catch (e: any) {
    console.log("wETH.leverageAMM() failed:", e.message?.slice(0, 100));
  }

  // Step 2: Check LeverageAMM.v3Vault()
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function v3Vault() view returns (address)",
    "function totalDebt() view returns (uint256)",
    "function stakingVault() view returns (address)",
    "function mim() view returns (address)",
    "function underlyingAsset() view returns (address)"
  ], signer);

  console.log("\n--- LeverageAMM State ---");
  
  try {
    const v3 = await amm.v3Vault();
    console.log("v3Vault():", v3);
    console.log("Matches expected:", v3.toLowerCase() === V3LP_VAULT.toLowerCase());
  } catch (e: any) {
    console.log("v3Vault() FAILED:", e.reason || e.message?.slice(0, 100));
    console.log("This is the problem! LeverageAMM cannot read its v3Vault address.");
  }

  try {
    const debt = await amm.totalDebt();
    console.log("totalDebt():", ethers.utils.formatUnits(debt, 18), "MIM");
  } catch (e: any) {
    console.log("totalDebt() failed");
  }

  try {
    const sv = await amm.stakingVault();
    console.log("stakingVault():", sv);
  } catch (e: any) {
    console.log("stakingVault() FAILED");
  }

  try {
    const mim = await amm.mim();
    console.log("mim():", mim);
  } catch (e: any) {
    console.log("mim() FAILED");
  }

  try {
    const underlying = await amm.underlyingAsset();
    console.log("underlyingAsset():", underlying);
  } catch (e: any) {
    console.log("underlyingAsset() FAILED");
  }

  // Step 3: Try calling V3LPVault.removeLiquidity directly
  console.log("\n--- Testing V3LPVault.removeLiquidity ---");
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)"
  ], signer);

  try {
    // Try with very small percentage (1 basis point = 0.01%)
    const [a0, a1] = await v3.callStatic.removeLiquidity(1, 0, 0);
    console.log("✅ removeLiquidity simulation succeeded");
    console.log("  amount0:", ethers.utils.formatUnits(a0, 18));
    console.log("  amount1:", ethers.utils.formatUnits(a1, 18));
  } catch (e: any) {
    console.log("❌ removeLiquidity FAILED:", e.reason || e.message?.slice(0, 200));
  }
}

main().catch(console.error);
