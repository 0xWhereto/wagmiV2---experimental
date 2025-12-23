import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Checking Current Shortfall ===\n");

  // Check total debt
  const amm = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)"
  ], signer);

  const totalDebt = await amm.totalDebt();
  console.log("Total Debt:", ethers.utils.formatUnits(totalDebt, 18), "MIM");

  // Check MIM in LeverageAMM
  const mim = await ethers.getContractAt("IERC20", MIM);
  const ammMIM = await mim.balanceOf(LEVERAGE_AMM);
  console.log("MIM in LeverageAMM:", ethers.utils.formatUnits(ammMIM, 18), "MIM");

  // Check MIM in V3LPVault
  const v3MIM = await mim.balanceOf(V3LP_VAULT);
  console.log("MIM in V3LPVault:", ethers.utils.formatUnits(v3MIM, 18), "MIM");

  // Simulate removeLiquidity to see how much MIM we'd get
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)"
  ], signer);

  try {
    const [a0, a1] = await v3.callStatic.removeLiquidity(10000, 0, 0); // 100%
    console.log("\nIf we remove 100% liquidity:");
    console.log("  Token0 (sWETH):", ethers.utils.formatUnits(a0, 18));
    console.log("  Token1 (MIM):", ethers.utils.formatUnits(a1, 18));

    const totalMIMAvailable = ammMIM.add(a1);
    console.log("\nTotal MIM available:", ethers.utils.formatUnits(totalMIMAvailable, 18));
    console.log("Total Debt:", ethers.utils.formatUnits(totalDebt, 18));
    
    const shortfall = totalDebt.sub(totalMIMAvailable);
    if (shortfall.gt(0)) {
      console.log("Shortfall:", ethers.utils.formatUnits(shortfall, 18), "MIM");
      console.log("\nNeed to inject", ethers.utils.formatUnits(shortfall.add(ethers.utils.parseUnits("0.1", 18)), 18), "MIM (with buffer)");
    } else {
      console.log("✅ No shortfall - should be able to withdraw");
    }
  } catch (e: any) {
    console.log("Error simulating removeLiquidity:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
