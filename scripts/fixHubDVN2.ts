import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// CORRECT lib addresses from endpoint query
const SONIC_SEND_LIB = "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7";
const SONIC_RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

// Sonic DVN
const SONIC_LZ_DVN = "0x282b3386571f7f794450d5789911a9804fa346b4";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Fix Hub DVN Config ===");
  console.log("Deployer:", deployer.address);
  console.log("Using SendLib:", SONIC_SEND_LIB);
  console.log("Using ReceiveLib:", SONIC_RECEIVE_LIB);
  
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    SONIC_LZ_ENDPOINT
  );
  
  const dvn = ethers.utils.getAddress(SONIC_LZ_DVN.toLowerCase());
  
  // ULN Config
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    [{
      confirmations: 1,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [dvn],
      optionalDVNs: []
    }]
  );
  
  console.log("\n1. Setting Receive DVN config for Arbitrum EID...");
  try {
    const receiveConfigs = [{
      eid: ARB_EID,
      configType: 2,
      config: ulnConfig
    }];
    
    let tx = await endpoint.setConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, receiveConfigs);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Receive DVN config set!");
  } catch (e: any) {
    console.error("Error:", e.reason || e.message);
  }
  
  console.log("\n2. Setting Send DVN config for Arbitrum EID...");
  try {
    const sendConfigs = [{
      eid: ARB_EID,
      configType: 2,
      config: ulnConfig
    }];
    
    let tx = await endpoint.setConfig(HUB_ADDRESS, SONIC_SEND_LIB, sendConfigs);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ Send DVN config set!");
  } catch (e: any) {
    console.error("Error:", e.reason || e.message);
  }
  
  console.log("\n✓ Done!");
}

main().catch(console.error);
