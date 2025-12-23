import { ethers } from "hardhat";

const ORACLE = "0x5C6604099cf19021CB77F3ED1F77F5F438666ff3";
const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";

async function main() {
  const [signer] = await ethers.getSigners();
  
  const oracle = new ethers.Contract(ORACLE, [
    "function pool() view returns (address)",
    "function twapPeriod() view returns (uint32)",
    "function getPrice() view returns (uint256)",
    "function getInversePrice() view returns (uint256)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function priceIsToken0PerToken1() view returns (bool)",
  ], signer);
  
  console.log("OracleAdapter:");
  
  try {
    const pool = await oracle.pool();
    console.log("  pool:", pool);
    console.log("  expected pool:", SWETH_MIM_POOL);
    console.log("  pool matches:", pool.toLowerCase() === SWETH_MIM_POOL.toLowerCase());
  } catch (e: any) {
    console.log("  pool error:", e.message?.slice(0, 100));
  }
  
  try {
    const twap = await oracle.twapPeriod();
    console.log("  twapPeriod:", twap);
  } catch (e) {}
  
  try {
    const price = await oracle.getPrice();
    console.log("  getPrice():", ethers.utils.formatEther(price));
  } catch (e: any) {
    console.log("  getPrice error:", e.message?.slice(0, 100));
  }
  
  try {
    const invPrice = await oracle.getInversePrice();
    console.log("  getInversePrice():", ethers.utils.formatEther(invPrice));
  } catch (e: any) {
    console.log("  getInversePrice error:", e.message?.slice(0, 100));
  }
  
  // Check the pool directly
  console.log("\nPool state:");
  const pool = new ethers.Contract(SWETH_MIM_POOL, [
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)",
  ], signer);
  
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const slot0 = await pool.slot0();
  const liq = await pool.liquidity();
  
  console.log("  token0:", token0, "(sWETH)" );
  console.log("  token1:", token1, "(MIM)");
  console.log("  sqrtPriceX96:", slot0[0].toString());
  console.log("  tick:", slot0[1]);
  console.log("  liquidity:", liq.toString());
  
  // Calculate price from sqrtPriceX96
  const sqrtPriceX96 = slot0[0];
  const Q96 = ethers.BigNumber.from(2).pow(96);
  // price = (sqrtPriceX96 / 2^96)^2 = token1/token0 = MIM/sWETH
  const price = sqrtPriceX96.mul(sqrtPriceX96).div(Q96).div(Q96);
  console.log("\n  Calculated MIM per sWETH:", price.toString());
  
  // More precise calculation
  const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / Math.pow(2, 96);
  const priceFloat = sqrtPrice * sqrtPrice;
  console.log("  Price (float):", priceFloat.toFixed(6), "MIM per sWETH");
}

main().catch(console.error);
