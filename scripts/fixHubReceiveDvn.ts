import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

// DVN on Sonic that corresponds to the Arbitrum DVN
// We need to match what the OLD gateway used successfully
const SONIC_DVN_FOR_ARB = "0x282b3386571f7f794450d5789911a9804FA346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Fixing Hub Receive DVN for Arbitrum ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function setConfig(address, address, tuple(uint32, uint32, bytes)[]) external",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const [receiveLib] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Receive library: ${receiveLib}`);
  
  // Check current config
  const currentConfig = await endpoint.getConfig(HUB, receiveLib, ARB_EID, 2);
  const currentDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    currentConfig
  );
  console.log(`Current DVN: ${currentDecoded[0][4].join(", ")}`);
  
  // Set to the DVN that works
  console.log(`\nSetting to: ${SONIC_DVN_FOR_ARB}`);
  
  const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 1, // Less confirmations for faster testing
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [SONIC_DVN_FOR_ARB],
      optionalDVNs: [],
    }]
  );
  
  const tx = await endpoint.setConfig(HUB, receiveLib, [
    { eid: ARB_EID, configType: 2, config: dvnConfigData }
  ], { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Done!`);
  
  // Verify
  const newConfig = await endpoint.getConfig(HUB, receiveLib, ARB_EID, 2);
  const newDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    newConfig
  );
  console.log(`\nVerified DVN: ${newDecoded[0][4].join(", ")}`);
}

main().catch(console.error);
