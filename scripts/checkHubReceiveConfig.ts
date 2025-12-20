import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== CHECKING HUB RECEIVE CONFIG ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)",
    "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(SONIC_ENDPOINT, endpointAbi, ethers.provider);
  
  // Get receive library
  const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, ARBITRUM_EID);
  console.log(`Receive library: ${receiveLib}`);
  console.log(`Is default: ${isDefault}`);
  
  // Get ULN config (configType 2)
  try {
    const ulnConfig = await endpoint.getConfig(HUB, receiveLib, ARBITRUM_EID, 2);
    console.log(`\nULN Config (raw): ${ulnConfig}`);
    
    // Decode ULN config
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      ulnConfig
    );
    console.log(`Confirmations: ${decoded[0].confirmations}`);
    console.log(`Required DVN count: ${decoded[0].requiredDVNCount}`);
    console.log(`Required DVNs: ${decoded[0].requiredDVNs.join(", ")}`);
  } catch (e: any) {
    console.log(`Error getting ULN config: ${e.message}`);
  }
  
  // Compare with Gateway's send DVN
  console.log("\n--- Gateway Send DVN (Arbitrum) ---");
  console.log("Gateway DVN: 0x2f55C492897526677C5B68fb199ea31E2c126416");
  
  console.log("\n--- Expected Hub Receive DVN (Sonic) ---");
  console.log("LZ Labs DVN on Sonic: 0x282b3386571f7f794450d5789911a9804fa346b4");
}

main().catch(console.error);
