import { ethers } from "hardhat";

const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const NEW_AMM = "0x7bFddcb8fD2A4A7621f4505Ba896a99B2DeD5a3E";
const POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debugging V12 ===\n");

  // Check what's in V3LPVault
  const mim = await ethers.getContractAt("IERC20", MIM);
  const sweth = await ethers.getContractAt("IERC20", SWETH);

  console.log("MIM in V3LPVault:", ethers.utils.formatUnits(await mim.balanceOf(V3LP_VAULT), 18));
  console.log("sWETH in V3LPVault:", ethers.utils.formatUnits(await sweth.balanceOf(V3LP_VAULT), 18));
  console.log("MIM in LeverageAMM:", ethers.utils.formatUnits(await mim.balanceOf(NEW_AMM), 18));
  console.log("sWETH in LeverageAMM:", ethers.utils.formatUnits(await sweth.balanceOf(NEW_AMM), 18));

  // Check if removeLiquidity returns MIM
  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function removeLiquidity(uint256, uint256, uint256) returns (uint256, uint256)",
    "function getTotalLiquidity() view returns (uint256, uint256)"
  ], signer);

  try {
    const [a0, a1] = await v3Vault.callStatic.removeLiquidity(1000, 0, 0); // 10% 
    console.log("\nSimulating removeLiquidity(1000):");
    console.log("  Token0 (sWETH):", ethers.utils.formatUnits(a0, 18));
    console.log("  Token1 (MIM):", ethers.utils.formatUnits(a1, 18));
  } catch (e: any) {
    console.log("removeLiquidity failed:", e.message?.slice(0, 100));
  }

  // Check pool state
  const pool = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
    "function liquidity() view returns (uint128)"
  ], signer);

  try {
    const [sqrtPriceX96, tick] = await pool.slot0();
    const liquidity = await pool.liquidity();
    console.log("\nPool state:");
    console.log("  Tick:", tick);
    console.log("  Liquidity:", liquidity.toString());
    
    // Calculate price: price = (sqrtPriceX96 / 2^96)^2
    const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / (2 ** 96);
    const price = sqrtPrice * sqrtPrice;
    console.log("  Price (MIM per sWETH):", price);
  } catch (e: any) {
    console.log("Pool read failed:", e.message?.slice(0, 100));
  }
}

main().catch(console.error);
