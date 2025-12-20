import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  console.log("=== CHECKING HUB LZ CONFIG ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const hubAbi = [
    "function endpoint() view returns (address)",
    "function oAppVersion() view returns (uint64 senderVersion, uint64 receiverVersion)",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, sonicProvider);
  
  try {
    const ep = await hub.endpoint();
    console.log(`Hub endpoint: ${ep}`);
  } catch (e: any) {
    console.log(`Error getting endpoint: ${e.reason || e.message?.slice(0, 100)}`);
  }
  
  try {
    const version = await hub.oAppVersion();
    console.log(`OApp version: sender=${version.senderVersion}, receiver=${version.receiverVersion}`);
  } catch (e: any) {
    console.log(`Error getting version: ${e.reason || e.message?.slice(0, 100)}`);
  }
  
  // Check if Hub is registered as a receiver
  const LZ_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
  const endpointAbi = [
    "function isRegisteredLibrary(address) view returns (bool)",
    "function defaultReceiveLibrary(uint32) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT, endpointAbi, sonicProvider);
  
  try {
    const defaultLib = await endpoint.defaultReceiveLibrary(30110); // ARB_EID
    console.log(`\nDefault receive library for Arbitrum: ${defaultLib}`);
  } catch (e: any) {
    console.log(`Error getting default lib: ${e.reason || e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
