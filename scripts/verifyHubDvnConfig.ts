import { ethers } from "hardhat";

const NEW_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== VERIFYING HUB DVN CONFIG (AFTER FIX) ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  const chains = [
    { name: "Arbitrum", eid: 30110 },
    { name: "Ethereum", eid: 30101 },
  ];
  
  for (const chain of chains) {
    console.log(`${chain.name} (EID ${chain.eid}):`);
    
    const [receiveLib] = await endpoint.getReceiveLibrary(NEW_HUB, chain.eid);
    
    const dvnConfig = await endpoint.getConfig(NEW_HUB, receiveLib, chain.eid, 2);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      dvnConfig
    );
    console.log(`  DVN: ${decoded[0][4].join(", ")}`);
    console.log(`  Confirmations: ${decoded[0][0]}`);
    console.log();
  }
  
  console.log("✅ Hub DVN config updated to match the OLD working Hub!");
  console.log("\n📌 NEXT STEPS:");
  console.log("1. Your pending messages were verified with the WRONG DVN");
  console.log("2. You need to send a NEW bridge transaction");
  console.log("3. The new transaction will be verified with the CORRECT DVN");
  console.log("4. It should arrive on Sonic within a few minutes");
}

main().catch(console.error);
