import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

// Arbitrum gateway and DVN
const ARB_GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const ARB_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416"; // DVN we set on Arb gateway

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Debugging LZ Receive on Hub ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address, bool)",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function defaultReceiveLibrary(uint32 _srcEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  // Check receive library for Arbitrum
  const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Hub receive library for Arbitrum:`);
  console.log(`  Library: ${receiveLib}`);
  console.log(`  Is default: ${isDefault}`);
  
  // Get DVN config (type 2)
  try {
    const dvnConfig = await endpoint.getConfig(HUB, receiveLib, ARB_EID, 2);
    console.log(`\nHub DVN config for receiving from Arbitrum:`);
    console.log(`  ${dvnConfig.substring(0, 200)}...`);
    
    // Decode the config
    // UlnConfig: confirmations, requiredDVNCount, optionalDVNCount, optionalDVNThreshold, requiredDVNs[], optionalDVNs[]
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      dvnConfig
    );
    
    console.log(`\nDecoded DVN config:`);
    console.log(`  Confirmations: ${decoded[0].confirmations}`);
    console.log(`  Required DVNs: ${decoded[0].requiredDVNs.join(", ")}`);
    console.log(`  Optional DVNs: ${decoded[0].optionalDVNs.join(", ")}`);
  } catch (e: any) {
    console.log(`Error getting DVN config: ${e.message?.substring(0, 100)}`);
  }
  
  // Check if message is pending
  console.log("\n=== Message Status ===");
  console.log("Check LayerZero Scan: https://layerzeroscan.com/tx/0x04c5e609b43b43e899b0640882bce2bf31b17777c615d2616b67843241f2ecd6");
  console.log("\nPossible issues:");
  console.log("1. DVN mismatch - Hub expects different DVN than gateway used");
  console.log("2. Message still being verified");
  console.log("3. Executor hasn't executed yet");
}

main().catch(console.error);
