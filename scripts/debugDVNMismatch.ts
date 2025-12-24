import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const ARB_EID = 30110;
const SONIC_EID = 30332;

// Endpoints
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_LZ_ENDPOINT = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";

// Libs
const SONIC_RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARB_SEND_LIB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("=== Debug DVN Config ===");
  console.log("Network:", network.name, "chainId:", network.chainId);
  
  const endpointABI = [
    "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"
  ];
  
  if (network.chainId === 42161) {
    // Arbitrum - check gateway's send config
    console.log("\n--- Arbitrum Gateway Send Config ---");
    const endpoint = await ethers.getContractAt(endpointABI, ARB_LZ_ENDPOINT);
    
    try {
      const config = await endpoint.getConfig(NEW_GATEWAY, ARB_SEND_LIB, SONIC_EID, 2);
      console.log("Raw config:", config);
      
      // Decode ULN config
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
        config
      );
      console.log("Decoded:");
      console.log("  confirmations:", decoded[0].confirmations.toString());
      console.log("  requiredDVNs:", decoded[0].requiredDVNs);
    } catch (e: any) {
      console.log("Error:", e.reason || e.message?.slice(0, 80));
    }
  } else if (network.chainId === 146) {
    // Sonic - check hub's receive config
    console.log("\n--- Sonic Hub Receive Config ---");
    const endpoint = await ethers.getContractAt(endpointABI, SONIC_LZ_ENDPOINT);
    
    try {
      const config = await endpoint.getConfig(HUB_ADDRESS, SONIC_RECEIVE_LIB, ARB_EID, 2);
      console.log("Raw config:", config);
      
      // Decode ULN config
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ['tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'],
        config
      );
      console.log("Decoded:");
      console.log("  confirmations:", decoded[0].confirmations.toString());
      console.log("  requiredDVNs:", decoded[0].requiredDVNs);
    } catch (e: any) {
      console.log("Error:", e.reason || e.message?.slice(0, 80));
    }
  }
}

main().catch(console.error);
