import { ethers } from "hardhat";

const OLD_ARB_GW = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const NEW_ARB_GW = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== COMPARING GATEWAY DVN CONFIGS ===\n");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  for (const [name, gw] of [["OLD", OLD_ARB_GW], ["NEW", NEW_ARB_GW]]) {
    console.log(`${name} Gateway: ${gw}`);
    
    const sendLib = await endpoint.getSendLibrary(gw, SONIC_EID);
    console.log(`  Send library: ${sendLib}`);
    
    const dvnConfig = await endpoint.getConfig(gw, sendLib, SONIC_EID, 2);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      dvnConfig
    );
    console.log(`  DVNs: ${decoded[0][4].join(", ")}`);
    console.log(`  Confirmations: ${decoded[0][0]}`);
    console.log();
  }
  
  console.log("The NEW Gateway should use the SAME DVN as the OLD Gateway.");
}

main().catch(console.error);
