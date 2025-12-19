import { ethers } from "hardhat";

async function main() {
  console.log("=== DVN CONFIGURATION VERIFICATION ===\n");
  
  // Arbitrum Gateway DVN
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const arbEndpoint = new ethers.Contract(
    "0x1a44076050125825900e736c501f859c50fE728c",
    ["function getSendLibrary(address, uint32) view returns (address)", "function getConfig(address, address, uint32, uint32) view returns (bytes)"],
    arbProvider
  );
  
  const arbGateway = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
  const sonicEid = 30332;
  
  const arbSendLib = await arbEndpoint.getSendLibrary(arbGateway, sonicEid);
  const arbDvnConfig = await arbEndpoint.getConfig(arbGateway, arbSendLib, sonicEid, 2);
  const arbDvnDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    arbDvnConfig
  );
  console.log("Arbitrum Gateway sends with DVN:");
  console.log(`  ${arbDvnDecoded[0][4].join(", ")}`);
  
  // Sonic Hub expects
  const [deployer] = await ethers.getSigners();
  const sonicEndpoint = new ethers.Contract(
    "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B",
    ["function getReceiveLibrary(address, uint32) view returns (address, bool)", "function getConfig(address, address, uint32, uint32) view returns (bytes)"],
    deployer
  );
  
  const hub = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const arbEid = 30110;
  
  const [sonicReceiveLib] = await sonicEndpoint.getReceiveLibrary(hub, arbEid);
  const sonicDvnConfig = await sonicEndpoint.getConfig(hub, sonicReceiveLib, arbEid, 2);
  const sonicDvnDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    sonicDvnConfig
  );
  console.log("\nSonic Hub expects DVN from Arbitrum:");
  console.log(`  ${sonicDvnDecoded[0][4].join(", ")}`);
  
  // These are on different chains, so addresses won't match directly
  // But they should be the same DVN network (e.g., LayerZero Labs DVN)
  console.log("\n⚠️ NOTE: DVN addresses are on different chains.");
  console.log("They must be part of the same DVN network for verification to work.");
  console.log("\nLayerZero Labs DVNs:");
  console.log("  Arbitrum: 0x2f55C492897526677C5B68fb199ea31E2c126416");
  console.log("  Sonic:    0x282b3386571f7f794450d5789911a9804FA346b4");
  
  const arbDvn = arbDvnDecoded[0][4][0]?.toLowerCase();
  const expectedArbDvn = "0x2f55C492897526677C5B68fb199ea31E2c126416".toLowerCase();
  const sonicDvn = sonicDvnDecoded[0][4][0]?.toLowerCase();
  const expectedSonicDvn = "0x282b3386571f7f794450d5789911a9804FA346b4".toLowerCase();
  
  console.log("\n=== MATCH CHECK ===");
  console.log(`Arbitrum DVN matches expected: ${arbDvn === expectedArbDvn ? "✅ YES" : "❌ NO"}`);
  console.log(`Sonic DVN matches expected: ${sonicDvn === expectedSonicDvn ? "✅ YES" : "❌ NO"}`);
  
  if (arbDvn === expectedArbDvn && sonicDvn === expectedSonicDvn) {
    console.log("\n✅ DVNs are correctly configured!");
    console.log("\nThe issue might be:");
    console.log("1. LayerZero executor backlog for Sonic");
    console.log("2. Sonic is a new chain and executor support may be limited");
    console.log("3. You may need to contact LayerZero support");
  }
}

main().catch(console.error);
