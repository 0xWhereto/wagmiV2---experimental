import { ethers } from "hardhat";

const NEW_HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// The DVN that the OLD working Hub used
const DEFAULT_DVN = "0x6788f52439ACA6BFF597d3eeC2DC9a44B8FEE842";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FIXING HUB DVN TO MATCH OLD WORKING CONFIG ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, deployer);
  
  // Update for both Arbitrum and Ethereum
  const chains = [
    { name: "Arbitrum", eid: 30110 },
    { name: "Ethereum", eid: 30101 },
  ];
  
  for (const chain of chains) {
    console.log(`\n=== ${chain.name} (EID ${chain.eid}) ===`);
    
    const [receiveLib] = await endpoint.getReceiveLibrary(NEW_HUB, chain.eid);
    console.log(`Receive library: ${receiveLib}`);
    
    // Get current config
    const currentConfig = await endpoint.getConfig(NEW_HUB, receiveLib, chain.eid, 2);
    const currentDecoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
      currentConfig
    );
    console.log(`Current DVN: ${currentDecoded[0][4].join(", ")}`);
    
    // Set to use the default DVN (same as old working Hub)
    console.log(`Setting to DEFAULT DVN: ${DEFAULT_DVN}`);
    
    const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      [{
        confirmations: 20, // Same as default
        requiredDVNCount: 1,
        optionalDVNCount: 0,
        optionalDVNThreshold: 0,
        requiredDVNs: [DEFAULT_DVN],
        optionalDVNs: [],
      }]
    );
    
    const params = [{
      eid: chain.eid,
      configType: 2,
      config: dvnConfigData
    }];
    
    const tx = await endpoint.setConfig(NEW_HUB, receiveLib, params, { gasLimit: 300000 });
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Updated!`);
  }
  
  console.log("\n\n🎉 Hub now uses the same DVN as the OLD working Hub!");
  console.log("Try bridging again - it should work now.");
}

main().catch(console.error);
