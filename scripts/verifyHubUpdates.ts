import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

const NEW_GATEWAYS = {
  arbitrum: { eid: 30110, address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609" },
  ethereum: { eid: 30101, address: "0x5826e10B513C891910032F15292B2F1b3041C3Df" },
  base: { eid: 30184, address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb" }, // Old Base
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const gettersAbi = [
    "function getGatewayVaultByEid(uint32 _eid) view returns (address)",
  ];
  
  const getters = new ethers.Contract(GETTERS, gettersAbi, deployer);
  
  console.log("=== Hub Gateway Mappings ===\n");
  
  for (const [chain, info] of Object.entries(NEW_GATEWAYS)) {
    const actual = await getters.getGatewayVaultByEid(info.eid);
    const match = actual.toLowerCase() === info.address.toLowerCase();
    console.log(`${chain.toUpperCase()} (EID ${info.eid}):`);
    console.log(`  Expected: ${info.address}`);
    console.log(`  Hub knows: ${actual}`);
    console.log(`  ${match ? "✅ MATCH" : "⏳ PENDING (LZ message may still be in transit)"}`);
    console.log();
  }
}

main().catch(console.error);
