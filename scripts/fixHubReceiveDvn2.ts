import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ARB_EID = 30110;
const SONIC_DVN_FOR_ARB = "0x282b3386571f7f794450d5789911a9804FA346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Fixing Hub Receive DVN for Arbitrum ===\n");
  
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address, bool)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  const [receiveLib] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Receive library: ${receiveLib}`);
  
  const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [SONIC_DVN_FOR_ARB],
      optionalDVNs: [],
    }]
  );
  
  console.log(`Setting DVN to: ${SONIC_DVN_FOR_ARB}`);
  
  const params = [{
    eid: ARB_EID,
    configType: 2,
    config: dvnConfigData
  }];
  
  const tx = await endpoint.setConfig(HUB, receiveLib, params, { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Done!`);
}

main().catch(console.error);
