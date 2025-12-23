import { ethers } from "hardhat";

const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";
const POSITION_MANAGER = "0x5826e10B513C891910032F15292B2F1b3041C3Df";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Checking Prerequisites ===\n");

  // Check pool
  const pool = new ethers.Contract(SWETH_MIM_POOL, [
    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)"
  ], signer);

  console.log("Pool:", SWETH_MIM_POOL);
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const fee = await pool.fee();
  console.log("  token0:", token0);
  console.log("  token1:", token1);
  console.log("  fee:", fee);

  // Check if tokens are valid
  const t0 = await ethers.getContractAt("IERC20", token0);
  const t1 = await ethers.getContractAt("IERC20", token1);

  try {
    const name0 = await t0.name?.() || "N/A";
    console.log("  token0 name:", name0);
  } catch (e) {
    console.log("  token0 name: [call failed]");
  }

  try {
    const name1 = await t1.name?.() || "N/A";
    console.log("  token1 name:", name1);
  } catch (e) {
    console.log("  token1 name: [call failed]");
  }

  // Check position manager
  const pm = new ethers.Contract(POSITION_MANAGER, [
    "function factory() view returns (address)"
  ], signer);

  try {
    const factory = await pm.factory();
    console.log("\nPosition Manager:", POSITION_MANAGER);
    console.log("  factory:", factory);
  } catch (e: any) {
    console.log("\nPosition Manager:", POSITION_MANAGER);
    console.log("  ERROR:", e.message?.slice(0, 100));
  }
}
main().catch(console.error);
