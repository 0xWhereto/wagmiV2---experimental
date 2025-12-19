import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== Detailed DVN Config ===\n");
  
  const sendLib = await endpoint.getSendLibrary(GATEWAY, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Get DVN config (type 2)
  const dvnConfig = await endpoint.getConfig(GATEWAY, sendLib, SONIC_EID, 2);
  console.log(`\nDVN config (raw): ${dvnConfig}`);
  
  // Decode
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    dvnConfig
  );
  
  console.log(`\nDecoded:`);
  console.log(`  confirmations: ${decoded[0].confirmations}`);
  console.log(`  requiredDVNCount: ${decoded[0].requiredDVNCount}`);
  console.log(`  optionalDVNCount: ${decoded[0].optionalDVNCount}`);
  console.log(`  optionalDVNThreshold: ${decoded[0].optionalDVNThreshold}`);
  console.log(`  requiredDVNs: ${decoded[0].requiredDVNs}`);
  console.log(`  optionalDVNs: ${decoded[0].optionalDVNs}`);
  
  // Check if requiredDVNs is empty
  if (decoded[0].requiredDVNs.length === 0 && decoded[0].requiredDVNCount > 0) {
    console.log(`\n❌ PROBLEM: requiredDVNCount is ${decoded[0].requiredDVNCount} but requiredDVNs array is empty!`);
  }
  
  if (decoded[0].requiredDVNs.length > 0) {
    console.log(`\n✅ DVN config looks valid`);
  }
}

main().catch(console.error);
