import { ethers } from "hardhat";

// Old Gateway that WAS working
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const ARB_EID = 30110;
const SONIC_EID = 30332;

const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const ARB_SEND_LIB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";

async function main() {
  console.log("=== Check Old Gateway DVN Config ===");
  
  const endpointABI = [
    "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"
  ];
  
  const endpoint = await ethers.getContractAt(endpointABI, ARB_LZ_ENDPOINT);
  
  console.log("Old Gateway:", OLD_GATEWAY);
  
  try {
    const config = await endpoint.getConfig(OLD_GATEWAY, ARB_SEND_LIB, SONIC_EID, 2);
    console.log("Raw config:", config);
    
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
      config
    );
    console.log("\nOld Gateway's Send DVN Config to Sonic:");
    console.log("  confirmations:", decoded[0].confirmations.toString());
    console.log("  requiredDVNs:", decoded[0].requiredDVNs);
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 80));
  }
}

main().catch(console.error);
