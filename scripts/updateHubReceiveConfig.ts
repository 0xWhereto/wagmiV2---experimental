import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// DVNs that our gateways use
// Arbitrum gateway uses: 0x2f55C492897526677C5B68fb199ea31E2c126416
// But we need to find the corresponding DVN on Sonic that verifies Arbitrum messages

// On Sonic, we need to accept messages verified by whatever DVN the Arbitrum gateway uses
// The Hub expects: 0x282b3386571f7f794450d5789911a9804FA346b4

// Let's check what the default DVN is for receiving from Arbitrum
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Updating Hub Receive Config ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType) external view returns (bytes)",
    "function defaultReceiveLibrary(uint32 _srcEid) external view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const CHAIN_EIDS = {
    arbitrum: 30110,
    ethereum: 30101,
  };
  
  for (const [chain, eid] of Object.entries(CHAIN_EIDS)) {
    console.log(`\n=== ${chain.toUpperCase()} (EID ${eid}) ===`);
    
    // Get current receive library
    const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(HUB, eid);
    console.log(`Receive library: ${receiveLib} (default: ${isDefault})`);
    
    // Get default receive library
    const defaultLib = await endpoint.defaultReceiveLibrary(eid);
    console.log(`Default receive library: ${defaultLib}`);
    
    // Check default DVN config
    try {
      const defaultConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, eid, 2);
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        defaultConfig
      );
      console.log(`Default DVNs: ${decoded[0][4].join(", ")}`);
      
      // Check current Hub config
      const currentConfig = await endpoint.getConfig(HUB, receiveLib, eid, 2);
      const currentDecoded = ethers.utils.defaultAbiCoder.decode(
        ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
        currentConfig
      );
      console.log(`Hub expects DVNs: ${currentDecoded[0][4].join(", ")}`);
      
      // If they don't match, update
      if (currentDecoded[0][4][0]?.toLowerCase() !== decoded[0][4][0]?.toLowerCase()) {
        console.log(`\n⚠️ Mismatch! Updating to use default DVN...`);
        
        // Build new config with default DVN
        const newConfig = ethers.utils.defaultAbiCoder.encode(
          ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
          [[
            1, // confirmations (less than 20 for faster testing)
            decoded[0][1], // requiredDVNCount
            decoded[0][2], // optionalDVNCount
            decoded[0][3], // optionalDVNThreshold
            decoded[0][4], // requiredDVNs (use default)
            decoded[0][5], // optionalDVNs
          ]]
        );
        
        try {
          const tx = await endpoint.setConfig(HUB, receiveLib, [
            { eid: eid, configType: 2, config: newConfig }
          ], { gasLimit: 300000 });
          console.log(`TX: ${tx.hash}`);
          await tx.wait();
          console.log(`✅ Updated!`);
        } catch (e: any) {
          console.log(`Error: ${e.message?.substring(0, 100)}`);
        }
      } else {
        console.log(`✅ Already using default DVN`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message?.substring(0, 100)}`);
    }
  }
}

main().catch(console.error);
