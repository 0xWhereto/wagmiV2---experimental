import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ETH_EID = 30101;

// DVN on Sonic that corresponds to the Ethereum DVN
// The OLD gateway uses 0x589dEDbD617e0CBcB916A9223F4d1300c294236b on Ethereum
// We need the corresponding Sonic DVN
const SONIC_DVN_FOR_ETH = "0x282b3386571f7f794450d5789911a9804FA346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Fixing Hub Receive DVN for Ethereum ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const [receiveLib] = await endpoint.getReceiveLibrary(HUB, ETH_EID);
  console.log(`Receive library: ${receiveLib}`);
  
  // Check current
  const currentConfig = await endpoint.getConfig(HUB, receiveLib, ETH_EID, 2);
  const currentDecoded = ethers.utils.defaultAbiCoder.decode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    currentConfig
  );
  console.log(`Current DVN: ${currentDecoded[0][4].join(", ")}`);
  
  // Set to single DVN
  const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [SONIC_DVN_FOR_ETH],
      optionalDVNs: [],
    }]
  );
  
  console.log(`Setting DVN to: ${SONIC_DVN_FOR_ETH}`);
  
  const params = [{
    eid: ETH_EID,
    configType: 2,
    config: dvnConfigData
  }];
  
  const tx = await endpoint.setConfig(HUB, receiveLib, params, { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Done!`);
}

main().catch(console.error);
