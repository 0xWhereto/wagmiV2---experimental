import { ethers } from "hardhat";

const NEW_AMM = "0x2E711256BaEa3A127C9E903898AD77C8ce5Ed9A9";
const NEW_WETH = "0xA3eFbd4FE35ABCA229959653930cc668888dc964";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debug closePosition ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  // Check wETH state
  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], signer);

  const shares = await weth.balanceOf(signer.address);
  const totalSupply = await weth.totalSupply();
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  console.log("Total Supply:", ethers.utils.formatUnits(totalSupply, 18));

  // Check AMM state
  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function underlyingIsToken0() view returns (bool)"
  ], signer);

  const debt = await amm.totalDebt();
  const underlying = await amm.totalUnderlying();
  const isToken0 = await amm.underlyingIsToken0();
  
  console.log("\nAMM State:");
  console.log("Total Debt:", ethers.utils.formatUnits(debt, 18), "MIM");
  console.log("Total Underlying:", ethers.utils.formatUnits(underlying, 18), "sWETH");
  console.log("Underlying is token0:", isToken0);

  // Calculate what closePosition would do
  console.log("\n--- Simulating closePosition logic ---");
  
  const WAD = ethers.utils.parseUnits("1", 18);
  const withdrawPercent = shares.mul(WAD).div(totalSupply);
  console.log("Withdraw percent:", ethers.utils.formatUnits(withdrawPercent, 18));

  const basisPoints = withdrawPercent.mul(10000).div(WAD);
  console.log("Basis points for removeLiquidity:", basisPoints.toString());

  // Simulate removal
  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)"
  ], signer);

  const [amount0, amount1] = await v3.callStatic.removeLiquidity(basisPoints, 0, 0);
  console.log("\nRemove liquidity would return:");
  console.log("  Token0 (sWETH):", ethers.utils.formatUnits(amount0, 18));
  console.log("  Token1 (MIM):", ethers.utils.formatUnits(amount1, 18));

  // Calculate debt to repay
  const debtToRepay = debt.mul(withdrawPercent).div(WAD);
  console.log("\nDebt to repay:", ethers.utils.formatUnits(debtToRepay, 18), "MIM");

  const underlyingAmount = isToken0 ? amount0 : amount1;
  const mimAmount = isToken0 ? amount1 : amount0;
  console.log("MIM from LP:", ethers.utils.formatUnits(mimAmount, 18));

  // Check existing MIM in LeverageAMM
  const ammMIM = await mim.balanceOf(NEW_AMM);
  console.log("MIM already in AMM:", ethers.utils.formatUnits(ammMIM, 18));

  const totalMIMAvailable = mimAmount.add(ammMIM);
  console.log("Total MIM available:", ethers.utils.formatUnits(totalMIMAvailable, 18));

  if (totalMIMAvailable.gte(debtToRepay)) {
    console.log("\n✅ Have enough MIM to repay debt");
  } else {
    console.log("\n❌ NOT enough MIM! Need swap");
    console.log("Shortfall:", ethers.utils.formatUnits(debtToRepay.sub(totalMIMAvailable), 18));
  }
}

main().catch(console.error);
