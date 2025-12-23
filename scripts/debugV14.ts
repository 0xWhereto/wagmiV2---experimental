import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_WETH = "0xb9d5bf7bA3977EEC67E3d161699BEA09618e6343";
const NEW_AMM = "0xbA9C438EFE27112A82291BA816cF15CE6aF3DccE";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debug v14 ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)"
  ], signer);

  const debt = await amm.totalDebt();
  const underlying = await amm.totalUnderlying();
  
  console.log("AMM Debt:", ethers.utils.formatUnits(debt, 18));
  console.log("AMM Underlying:", ethers.utils.formatUnits(underlying, 18));
  console.log("MIM in AMM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));

  // Check V3LPVault
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)"
  ], signer);

  try {
    const [a0, a1] = await v3.callStatic.removeLiquidity(10000, 0, 0);
    console.log("\nV3 has liquidity:");
    console.log("  sWETH:", ethers.utils.formatUnits(a0, 18));
    console.log("  MIM:", ethers.utils.formatUnits(a1, 18));
    
    // The debt is 1.5 MIM, LP has 1.5 MIM
    // After dust fix, if shortfall < 0.0001 MIM, we should reduce debtToRepay
    const shortfall = debt.sub(a1);
    console.log("\nShortfall:", shortfall.toString(), "wei =", ethers.utils.formatUnits(shortfall, 18), "MIM");
    
    const DUST = ethers.BigNumber.from("100000000000000"); // 1e14 = 0.0001 MIM
    console.log("Dust threshold:", DUST.toString(), "wei =", ethers.utils.formatUnits(DUST, 18), "MIM");
    console.log("Is shortfall < dust?", shortfall.lt(DUST));
  } catch (e: any) {
    console.log("V3 has no liquidity or error:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
