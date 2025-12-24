import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const SONIC_RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

// Sonic side of LZ Labs DVN
const SONIC_LZ_DVN = ethers.utils.getAddress("0x282b3386571f7f794450d5789911a9804fa346b4");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Fix Hub Receive Config ===");
  
  // First check current config
  const endpointRead = await ethers.getContractAt(
    ["function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"],
    SONIC_LZ_ENDPOINT
  );
  
  try {
    const config = await endpointRead.getConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, ARB_EID, 2);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
      config
    );
    console.log("Current Hub receive config:");
    console.log("  confirmations:", decoded[0].confirmations.toString());
    console.log("  requiredDVNs:", decoded[0].requiredDVNs);
  } catch (e: any) {
    console.log("Error reading current config:", e.reason || e.message?.slice(0, 50));
  }
  
  // Update to use SONIC DVN with 20 confirmations
  console.log("\nUpdating Hub receive config...");
  console.log("Using Sonic DVN:", SONIC_LZ_DVN);
  console.log("Using 20 confirmations");
  
  const endpoint = await ethers.getContractAt(
    ["function setConfig(address oapp, address lib, tuple(uint32 eid, uint32 configType, bytes config)[] configs) external"],
    SONIC_LZ_ENDPOINT
  );
  
  const ulnConfig = ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
    [{
      confirmations: 20,  // Match source chain
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [SONIC_LZ_DVN],
      optionalDVNs: []
    }]
  );
  
  const configs = [{
    eid: ARB_EID,
    configType: 2,
    config: ulnConfig
  }];
  
  const tx = await endpoint.setConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, configs);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Hub receive config updated!");
  
  // Verify
  try {
    const newConfig = await endpointRead.getConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, ARB_EID, 2);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
      newConfig
    );
    console.log("\nNew Hub receive config:");
    console.log("  confirmations:", decoded[0].confirmations.toString());
    console.log("  requiredDVNs:", decoded[0].requiredDVNs);
  } catch (e: any) {
    console.log("Error verifying:", e.reason || e.message?.slice(0, 50));
  }
}

main().catch(console.error);
