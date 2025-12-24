import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS = "0x2801131F630Fe5Cfb2f6349e40cA28a29C9788a7";
const ARB_EID = 30110;

const USDC = ethers.utils.getAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
const NEW_SUSDC = "0x162996118D8075Cb7857BE331001d281474A5D8d";

async function main() {
  console.log("=== Debug Link Error ===");
  
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB_ADDRESS);
  const getters = await ethers.getContractAt("SyntheticTokenHubGetters", GETTERS);
  
  // Check if remote token is already linked
  console.log("1. Checking if USDC is already linked...");
  try {
    const synthAddr = await getters.getSyntheticAddressByRemoteAddress(ARB_EID, USDC);
    console.log("   USDC already linked to:", synthAddr);
  } catch (e: any) {
    console.log("   Error:", e.reason || e.message?.slice(0, 50));
  }
  
  // Check if the new synthetic token is properly registered
  console.log("\n2. Checking if new sUSDC is registered...");
  try {
    const index = await getters.getTokenIndexByAddress(NEW_SUSDC);
    console.log("   Token index:", index.toString());
    console.log("   Is registered:", index.gt(0));
  } catch (e: any) {
    console.log("   Error:", e.reason || e.message?.slice(0, 50));
  }
  
  // Try to simulate the manualLinkRemoteToken call
  console.log("\n3. Static call to manualLinkRemoteToken...");
  try {
    await hub.callStatic.manualLinkRemoteToken(
      NEW_SUSDC,
      ARB_EID,
      USDC,
      "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071",
      0,
      "1000000"
    );
    console.log("   Would succeed!");
  } catch (e: any) {
    console.log("   Revert reason:", e.reason || e.errorName || e.message?.slice(0, 100));
    if (e.error?.data) {
      console.log("   Error data:", e.error.data);
    }
  }
}

main().catch(console.error);
