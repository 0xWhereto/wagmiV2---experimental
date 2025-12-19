import { ethers } from "hardhat";

const NEW_ETH_GATEWAY = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

// DVN that OLD gateway uses (working)
const WORKING_DVN = "0x589dEDbD617e0CBcB916A9223F4d1300c294236b";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== Fixing Ethereum Gateway DVN ===\n");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function setConfig(address _oapp, address _lib, tuple(uint32 eid, uint32 configType, bytes config)[] _params) external",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, deployer);
  
  const sendLib = await endpoint.getSendLibrary(NEW_ETH_GATEWAY, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  const dvnConfigData = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    [{
      confirmations: 20,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [WORKING_DVN],
      optionalDVNs: [],
    }]
  );
  
  console.log(`Setting DVN to: ${WORKING_DVN}`);
  
  const params = [{
    eid: SONIC_EID,
    configType: 2,
    config: dvnConfigData
  }];
  
  const tx = await endpoint.setConfig(NEW_ETH_GATEWAY, sendLib, params, { gasLimit: 300000 });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Done!`);
}

main().catch(console.error);
