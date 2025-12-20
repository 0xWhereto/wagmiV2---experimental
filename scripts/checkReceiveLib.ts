import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  console.log("=== CHECKING HUB RECEIVE LIBRARY CONFIG ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Check the receive library for the Hub
  const endpointAbi = [
    "function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address lib, bool isDefault)",
  ];
  
  const LZ_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, sonicProvider);
  
  const [lib, isDefault] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Receive library: ${lib}`);
  console.log(`Is default: ${isDefault}`);
  
  // Now check the ULN config for this receive library
  const ulnAbi = [
    "function getUlnConfig(address _oapp, uint32 _remoteEid) external view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  
  const receiveLib = new ethers.Contract(lib, ulnAbi, sonicProvider);
  
  try {
    const config = await receiveLib.getUlnConfig(HUB, ARB_EID);
    console.log(`\nReceive ULN Config:`);
    console.log(`  Confirmations: ${config.confirmations}`);
    console.log(`  Required DVN count: ${config.requiredDVNCount}`);
    console.log(`  Required DVNs: ${config.requiredDVNs.join(', ')}`);
  } catch (e: any) {
    console.log(`Error getting config: ${e.message?.slice(0, 100)}`);
  }
  
  // Check if there's a delegate set
  console.log("\n=== CHECKING DELEGATE ===");
  const delegateAbi = [
    "function delegates(address) view returns (address)",
  ];
  const endpointDel = new ethers.Contract(LZ_ENDPOINT, delegateAbi, sonicProvider);
  try {
    const delegate = await endpointDel.delegates(HUB);
    console.log(`Hub delegate: ${delegate}`);
  } catch (e: any) {
    console.log(`No delegate function or error`);
  }
}

main().catch(console.error);
