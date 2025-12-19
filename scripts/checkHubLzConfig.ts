import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) external view returns (address)",
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address, bool)",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function defaultSendLibrary(uint32 _dstEid) external view returns (address)",
    "function defaultReceiveLibrary(uint32 _srcEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  console.log("=== Hub LZ Configuration ===\n");
  
  const chains = [
    { name: "Arbitrum", eid: 30110 },
    { name: "Ethereum", eid: 30101 },
  ];
  
  for (const chain of chains) {
    console.log(`\n${chain.name} (EID ${chain.eid}):`);
    
    try {
      const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, chain.eid);
      console.log(`  Receive library: ${receiveLib} (default: ${isDefault})`);
      
      // Check receive DVN config (type 2)
      if (!isDefault) {
        const config = await endpoint.getConfig(HUB, receiveLib, chain.eid, 2);
        console.log(`  DVN config: ${config.substring(0, 80)}...`);
      } else {
        console.log(`  Using default DVN config`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 60)}`);
    }
  }
}

main().catch(console.error);
