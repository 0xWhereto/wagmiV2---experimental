import { ethers } from "hardhat";

const OLD_ARB_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const NEW_ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const SONIC_EID = 30332;
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== COMPARING OLD vs NEW GATEWAY CONFIG ===\n");
  
  for (const [name, addr] of [["OLD", OLD_ARB_GATEWAY], ["NEW", NEW_ARB_GATEWAY]]) {
    console.log(`${name} Gateway: ${addr}`);
    
    const sendLib = await endpoint.getSendLibrary(addr, SONIC_EID);
    console.log(`  Send library: ${sendLib}`);
    
    // DVN
    const dvnConfig = await endpoint.getConfig(addr, sendLib, SONIC_EID, 2);
    const dvnDecoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      dvnConfig
    );
    console.log(`  Confirmations: ${dvnDecoded[0][0]}`);
    console.log(`  DVNs: ${dvnDecoded[0][4].join(", ")}`);
    
    // Executor
    const execConfig = await endpoint.getConfig(addr, sendLib, SONIC_EID, 1);
    const execDecoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint32, address)"],
      execConfig
    );
    console.log(`  Executor: ${execDecoded[0][1]}`);
    console.log(`  Max message: ${execDecoded[0][0]}`);
    console.log();
  }
  
  console.log("If configs are the same, the issue is LayerZero executor support for Sonic.");
}

main().catch(console.error);
