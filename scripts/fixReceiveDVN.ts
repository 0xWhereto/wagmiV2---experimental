import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const SONIC_EID = 30332;
const ARB_LZ_DVN = ethers.utils.getAddress("0x2f55c492897526677c5b68fb199ea31e2c126416");
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Fix Receive DVN Config ===");
  
  const receiveLib = ethers.utils.getAddress("0x7b9e184e07a6ee1ac23eae0fe8d6be2f663f05e6");
  console.log("ReceiveLib:", receiveLib);
  
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    ARB_LZ_ENDPOINT
  );
  
  console.log("Setting Receive DVN config...");
  const receiveUlnConfig = ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [ARB_LZ_DVN],
      optionalDVNs: []
    }]
  );
  
  const receiveConfigs = [{
    eid: SONIC_EID,
    configType: 2,
    config: receiveUlnConfig
  }];
  
  const tx = await endpoint.setConfig(NEW_GATEWAY, receiveLib, receiveConfigs);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Receive DVN config set!");
}

main().catch(console.error);
