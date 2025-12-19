import { ethers } from "hardhat";

const OLD_ETH_GW = "0xba36FC6568B953f691dd20754607590C59b7646a";
const NEW_ETH_GW = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
  
  console.log("=== CHECKING ETHEREUM GATEWAY DVN ===\n");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  for (const [name, gw] of [["OLD", OLD_ETH_GW], ["NEW", NEW_ETH_GW]]) {
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
}

main().catch(console.error);
