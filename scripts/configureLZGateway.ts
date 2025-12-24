import { ethers } from "hardhat";

// New Arbitrum Gateway
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";

// Sonic EID
const SONIC_EID = 30332;

// LZ Labs DVN on Arbitrum
const ARB_LZ_DVN = "0x2f55C492897526677C5B68fb199ea31E2c126416";

// LZ Endpoint on Arbitrum
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Configure LZ for New Gateway ===");
  console.log("Deployer:", deployer.address);
  console.log("Gateway:", NEW_GATEWAY);
  
  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
  
  // Get endpoint
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    ARB_LZ_ENDPOINT
  );
  
  // Get Send and Receive libraries from endpoint
  const sendLib = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";  // Arbitrum SendLib302
  const receiveLib = "0x7B9E184e07a6EE1AC23eAe0fe8D6Be2f663f05e6"; // Arbitrum ReceiveLib302
  
  console.log("\n1. Setting Send DVN config...");
  // SendLib ULN config type = 2
  // ULN Config structure for send
  const sendUlnConfig = ethers.utils.defaultAbiCoder.encode(
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
  
  const sendConfigs = [{
    eid: SONIC_EID,
    configType: 2, // ULN config type
    config: sendUlnConfig
  }];
  
  try {
    let tx = await endpoint.setConfig(NEW_GATEWAY, sendLib, sendConfigs);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Send DVN config set!");
  } catch (e: any) {
    console.error("Send config error:", e.reason || e.message?.slice(0, 100));
  }
  
  console.log("\n2. Setting Receive DVN config...");
  // ReceiveLib ULN config type = 2
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
  
  try {
    let tx = await endpoint.setConfig(NEW_GATEWAY, receiveLib, receiveConfigs);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Receive DVN config set!");
  } catch (e: any) {
    console.error("Receive config error:", e.reason || e.message?.slice(0, 100));
  }
  
  console.log("\n✓ Gateway LZ configuration complete!");
}

main().catch(console.error);
