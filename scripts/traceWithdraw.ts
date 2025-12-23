import { ethers } from "hardhat";

const NEW_WETH = "0x1d71d3aaaEf85C1d3c78c9EC670AC097Db804634";
const NEW_AMM = "0xbBe44C50D260f54Eee92044419F25a4e1c579d30";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Trace Withdraw Flow ===\n");

  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);
  
  const weth = new ethers.Contract(NEW_WETH, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function leverageAMM() view returns (address)"
  ], signer);

  const amm = new ethers.Contract(NEW_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function v3LPVault() view returns (address)",
    "function wToken() view returns (address)"
  ], signer);

  const v3 = new ethers.Contract(V3LP_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function layers(uint256) view returns (int24 tickLower, int24 tickUpper, uint256 tokenId, uint128 liquidity)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ], signer);

  // Check configuration
  console.log("--- Configuration ---");
  console.log("WToken.leverageAMM:", await weth.leverageAMM());
  console.log("LeverageAMM.v3LPVault:", await amm.v3LPVault());
  console.log("LeverageAMM.wToken:", await amm.wToken());
  console.log("V3LPVault.token0:", await v3.token0());
  console.log("V3LPVault.token1:", await v3.token1());

  // Check state
  console.log("\n--- Current State ---");
  const shares = await weth.balanceOf(signer.address);
  const totalSupply = await weth.totalSupply();
  console.log("Shares:", ethers.utils.formatUnits(shares, 18));
  console.log("TotalSupply:", ethers.utils.formatUnits(totalSupply, 18));
  console.log("AMM totalDebt:", ethers.utils.formatUnits(await amm.totalDebt(), 18));
  console.log("AMM totalUnderlying:", ethers.utils.formatUnits(await amm.totalUnderlying(), 18));

  const [assets0, assets1] = await v3.getTotalAssets();
  console.log("V3 assets0:", ethers.utils.formatUnits(assets0, 18));
  console.log("V3 assets1:", ethers.utils.formatUnits(assets1, 18));

  // Check layer 0
  try {
    const layer0 = await v3.layers(0);
    console.log("\nLayer 0:");
    console.log("  tokenId:", layer0.tokenId.toString());
    console.log("  liquidity:", layer0.liquidity.toString());
  } catch (e) {
    console.log("\nNo layers configured");
  }

  // Balances
  console.log("\n--- Balances ---");
  console.log("V3 sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(V3LP_VAULT), 18));
  console.log("V3 MIM:", ethers.utils.formatUnits(await mim.balanceOf(V3LP_VAULT), 18));
  console.log("AMM sWETH:", ethers.utils.formatUnits(await sweth.balanceOf(NEW_AMM), 18));
  console.log("AMM MIM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));
}
main().catch(console.error);
