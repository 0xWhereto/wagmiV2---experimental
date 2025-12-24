import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const SONIC_EID = 30332;
const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const ARB_SEND_LIB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";

// Config type 1 = Executor config
async function main() {
  console.log("=== Check Executor Config ===");
  
  const endpointABI = [
    "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) external view returns (bytes memory config)"
  ];
  const endpoint = await ethers.getContractAt(endpointABI, ARB_LZ_ENDPOINT);
  
  // Check executor config (type 1)
  console.log("\nExecutor config (type 1)...");
  try {
    const config = await endpoint.getConfig(NEW_GATEWAY, ARB_SEND_LIB, SONIC_EID, 1);
    console.log("Raw config:", config);
    
    // Decode executor config: (uint32 maxMessageSize, address executorAddress)
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['uint32', 'address'],
      config
    );
    console.log("Max message size:", decoded[0].toString());
    console.log("Executor:", decoded[1]);
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 100));
  }
  
  // Also check send library version
  console.log("\nSend library config...");
  try {
    // Check default executor for SendLib302
    const sendLibABI = [
      "function getExecutor(address _oapp, uint32 _eid) external view returns (address)"
    ];
    const sendLib = await ethers.getContractAt(sendLibABI, ARB_SEND_LIB);
    const executor = await sendLib.getExecutor(NEW_GATEWAY, SONIC_EID);
    console.log("Executor for new gateway:", executor);
  } catch (e: any) {
    console.log("Error:", e.reason || e.message?.slice(0, 100));
  }
}

main().catch(console.error);
