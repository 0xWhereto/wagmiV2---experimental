import { ethers } from "hardhat";

const SIMPLE_ORACLE = "0xB09aEeBe0E3DFca9F8fEA8F050F7D4b5f70DcF20";
const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check Oracle ===\n");

  // Check if oracle exists
  const code = await ethers.provider.getCode(SIMPLE_ORACLE);
  console.log("Oracle code length:", code.length);
  console.log("Is a contract:", code.length > 2);

  // If exists, check its pool
  if (code.length > 2) {
    const oracle = new ethers.Contract(SIMPLE_ORACLE, [
      "function pool() view returns (address)"
    ], signer);

    try {
      const pool = await oracle.pool();
      console.log("Oracle pool:", pool);
      console.log("Expected pool:", SWETH_MIM_POOL);
    } catch (e: any) {
      console.log("pool() failed:", e.message?.slice(0, 100));
    }
  } else {
    console.log("\n⚠️ Oracle does not exist! Need to redeploy.");
  }
}
main().catch(console.error);
