import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

const EXPECTED = {
  arbitrum: { eid: 30110, gateway: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e" },
  ethereum: { eid: 30101, gateway: "0xBb34D03d6110c079858B3Dd71F3791647b8F62cf" },
  base: { eid: 30184, gateway: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb" },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const gettersAbi = [
    "function getGatewayVaultByEid(uint32 _eid) view returns (address)",
  ];
  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);
  
  console.log("=== Hub Gateway Mappings ===\n");
  
  for (const [chain, info] of Object.entries(EXPECTED)) {
    const actual = await getters.getGatewayVaultByEid(info.eid);
    const match = actual.toLowerCase() === info.gateway.toLowerCase();
    console.log(`${chain.toUpperCase()} (EID ${info.eid}):`);
    console.log(`  Expected: ${info.gateway}`);
    console.log(`  Actual:   ${actual}`);
    console.log(`  Status:   ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
    console.log();
  }
}

main().catch(console.error);
