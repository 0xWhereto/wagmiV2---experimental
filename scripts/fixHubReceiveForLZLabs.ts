import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;

// The LZ Labs DVN on Sonic that corresponds to LZ Labs DVN on Arbitrum
// Gateway uses: 0x2f55c492897526677c5b68fb199ea31e2c126416 (Arbitrum)
// Hub should trust: 0x282b3386571f7f794450d5789911a9804fa346b4 (Sonic)
const SONIC_LZ_LABS_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FIXING HUB RECEIVE CONFIG FOR LZ LABS DVN ===\n");
  console.log(`Deployer: ${deployer.address}`);
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const [receiveLib] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Receive library: ${receiveLib}`);
  
  const uln = new ethers.Contract(receiveLib, ulnAbi, deployer);
  
  // Check current config
  const currentConfig = await uln.getUlnConfig(HUB, ARB_EID);
  console.log(`\nCurrent DVN config:`);
  console.log(`  Confirmations: ${currentConfig.confirmations}`);
  console.log(`  Required DVNs: ${currentConfig.requiredDVNs.join(", ")}`);
  
  if (currentConfig.requiredDVNs[0]?.toLowerCase() === SONIC_LZ_LABS_DVN.toLowerCase()) {
    console.log(`\n✅ Already using correct LZ Labs DVN`);
    return;
  }
  
  // Set to LZ Labs DVN
  console.log(`\n=== Setting Hub receive DVN to LZ Labs ===`);
  console.log(`Target DVN: ${SONIC_LZ_LABS_DVN}`);
  
  const dvnConfig = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64, uint8, uint8, uint8, address[], address[])"],
    [[
      20,  // confirmations
      1,   // requiredDVNCount
      0,   // optionalDVNCount
      0,   // optionalDVNThreshold
      [SONIC_LZ_LABS_DVN], // requiredDVNs
      [], // optionalDVNs
    ]]
  );
  
  const tx = await endpoint.setConfig(HUB, receiveLib, [
    { eid: ARB_EID, configType: 2, config: dvnConfig },
  ], { gasLimit: 300000 });
  
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Hub receive config updated!`);
  
  // Verify
  const newConfig = await uln.getUlnConfig(HUB, ARB_EID);
  console.log(`\nNew DVN config:`);
  console.log(`  Required DVNs: ${newConfig.requiredDVNs.join(", ")}`);
}

main().catch(console.error);


