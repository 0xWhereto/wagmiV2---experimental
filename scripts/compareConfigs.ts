import { ethers } from "hardhat";

const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

const GATEWAYS = [
  { name: "NEW", address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609" },
  { name: "OLD", address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e" },
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
    "function isRegisteredLibrary(address) view returns (bool)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== Comparing LZ Configs ===\n");
  
  for (const gw of GATEWAYS) {
    console.log(`\n${gw.name} Gateway: ${gw.address}`);
    
    try {
      const sendLib = await endpoint.getSendLibrary(gw.address, SONIC_EID);
      console.log(`  Send library: ${sendLib}`);
      
      // Get DVN config
      const dvnConfig = await endpoint.getConfig(gw.address, sendLib, SONIC_EID, 2);
      const dvnDecoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        dvnConfig
      );
      console.log(`  DVN: ${dvnDecoded[0][4].join(", ")}`);
      console.log(`  Confirmations: ${dvnDecoded[0][0]}`);
      
      // Get Executor config
      const execConfig = await endpoint.getConfig(gw.address, sendLib, SONIC_EID, 1);
      const execDecoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint32, address)"],
        execConfig
      );
      console.log(`  Executor: ${execDecoded[0][1]}`);
      console.log(`  Max message size: ${execDecoded[0][0]}`);
      
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
