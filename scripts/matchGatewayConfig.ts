import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const SONIC_EID = 30332;
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const ARB_SEND_LIB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";
const ARB_RECEIVE_LIB = "0x7B9E184e07a6EE1AC23eAe0fe8D6Be2f663f05e6";
const ARB_LZ_DVN = ethers.utils.getAddress("0x2f55c492897526677c5b68fb199ea31e2c126416");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Update New Gateway DVN Config to Match Old ===");
  
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    ARB_LZ_ENDPOINT
  );
  
  // ULN Config with 20 confirmations (matching old gateway)
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    [{
      confirmations: 20,  // Changed from 1 to 20
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [ARB_LZ_DVN],
      optionalDVNs: []
    }]
  );
  
  console.log("\n1. Updating Send config with 20 confirmations...");
  const sendConfigs = [{
    eid: SONIC_EID,
    configType: 2,
    config: ulnConfig
  }];
  
  let tx = await endpoint.setConfig(NEW_GATEWAY, ARB_SEND_LIB, sendConfigs);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Send config updated!");
  
  console.log("\n2. Updating Receive config with 20 confirmations...");
  const receiveConfigs = [{
    eid: SONIC_EID,
    configType: 2,
    config: ulnConfig
  }];
  
  tx = await endpoint.setConfig(NEW_GATEWAY, ARB_RECEIVE_LIB, receiveConfigs);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Receive config updated!");
  
  console.log("\n✓ New gateway now has same DVN config as old gateway!");
}

main().catch(console.error);
