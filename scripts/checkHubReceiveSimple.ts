import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const SONIC_ENDPOINT = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== CHECKING HUB RECEIVE CONFIG ===\n");
  
  // Check Hub's delegate/owner
  const hub = await ethers.getContractAt("SyntheticTokenHub", HUB);
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);
  
  // Try to get endpoint delegate
  const endpointAbi = [
    "function delegates(address oapp) view returns (address)",
    "function defaultReceiveLibrary(uint32 srcEid) view returns (address)",
    "function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)",
  ];
  
  const endpoint = new ethers.Contract(SONIC_ENDPOINT, endpointAbi, ethers.provider);
  
  try {
    const delegate = await endpoint.delegates(HUB);
    console.log(`Hub delegate: ${delegate}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Get default receive library
  try {
    const defaultLib = await endpoint.defaultReceiveLibrary(ARBITRUM_EID);
    console.log(`Default receive library for Arbitrum: ${defaultLib}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
  
  console.log("\n--- The Hub may be using default DVN configs ---");
  console.log("Message might be pending DVN verification.");
  console.log("\nCheck: https://layerzeroscan.com/tx/0xa7632e0ef6a250e926bae11e6188ca2859ebf3b69fbc583cb66ca21f7ebd17e3");
}

main().catch(console.error);
