import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;
const ETH_EID = 30101;

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== HUB ENDPOINT CONFIGURATION ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
    "function delegates(address) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  // Check delegate
  try {
    const delegate = await endpoint.delegates(HUB);
    console.log(`Hub delegate: ${delegate}`);
  } catch (e) {
    console.log("No delegate function");
  }
  
  for (const [name, eid] of [["Arbitrum", ARB_EID], ["Ethereum", ETH_EID]]) {
    console.log(`\n${name} (EID ${eid}):`);
    
    try {
      const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, eid as number);
      console.log(`  Receive library: ${receiveLib} (default: ${isDefault})`);
      
      // DVN config
      const dvnConfig = await endpoint.getConfig(HUB, receiveLib, eid as number, 2);
      const dvnDecoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        dvnConfig
      );
      console.log(`  Required DVNs: ${dvnDecoded[0][4].join(", ")}`);
      console.log(`  Confirmations: ${dvnDecoded[0][0]}`);
      
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 80)}`);
    }
  }
  
  // Check if Hub is paused
  const hubAbi = [
    "function paused() view returns (bool)",
  ];
  
  try {
    const hub = new ethers.Contract(HUB, hubAbi, deployer);
    const isPaused = await hub.paused();
    console.log(`\nHub paused: ${isPaused}`);
  } catch (e) {
    console.log("\nNo paused function or Hub not paused");
  }
}

main().catch(console.error);
