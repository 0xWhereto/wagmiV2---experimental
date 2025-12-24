import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const SONIC_EID = 30332;

async function main() {
  console.log("=== Check Enforced Options ===");
  
  // Check OAppOptionsType3 enforced options on both gateways
  const optionsABI = [
    "function enforcedOptions(uint32 eid, uint16 msgType) external view returns (bytes memory)"
  ];
  
  console.log("Checking NEW gateway...");
  const newGateway = await ethers.getContractAt(optionsABI, NEW_GATEWAY);
  for (const msgType of [1, 2, 3, 4]) {
    try {
      const options = await newGateway.enforcedOptions(SONIC_EID, msgType);
      console.log(`  MsgType ${msgType}:`, options || "(empty)");
    } catch (e) {
      console.log(`  MsgType ${msgType}: not set`);
    }
  }
  
  console.log("\nChecking OLD gateway...");
  const oldGateway = await ethers.getContractAt(optionsABI, OLD_GATEWAY);
  for (const msgType of [1, 2, 3, 4]) {
    try {
      const options = await oldGateway.enforcedOptions(SONIC_EID, msgType);
      console.log(`  MsgType ${msgType}:`, options || "(empty)");
    } catch (e) {
      console.log(`  MsgType ${msgType}: not set`);
    }
  }
  
  // Also check the endpoint's allowInitializePath
  console.log("\nChecking endpoint init path...");
  const ARB_LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
  const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  const endpointABI = [
    "function initializable((uint32,bytes32) origin, address receiver) external view returns (bool)"
  ];
  const endpoint = await ethers.getContractAt(endpointABI, ARB_LZ_ENDPOINT);
  
  const gatewayBytes = ethers.utils.hexZeroPad(NEW_GATEWAY, 32);
  try {
    const canInit = await endpoint.initializable({ srcEid: SONIC_EID, sender: gatewayBytes }, NEW_GATEWAY);
    console.log("New gateway initializable:", canInit);
  } catch (e: any) {
    console.log("Error checking initializable:", e.message?.slice(0, 60));
  }
}

main().catch(console.error);
