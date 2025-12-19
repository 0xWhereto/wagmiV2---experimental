import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const SEND_LIB = "0x775Fe41D3D4d6fE7E5a4b3bC4f9F5f5bEEfb4FE5"; // Might not be correct
const RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== FINDING EXECUTOR FROM SEND LIBRARY ===\n");
  
  // The send library on the source chain determines which executor is used
  // But on the destination, we need to see what executor calls lzReceive
  
  // Let's check the MessageLib registry
  const endpointAbi = [
    "function messageLibrary() view returns (address)",
    "function sendLibrary() view returns (address)",
  ];
  
  // Check the receive library for executor config
  const receiveLibAbi = [
    "function treasury() view returns (address)",
    "function endpoint() view returns (address)",
  ];
  
  const receiveLib = new ethers.Contract(RECEIVE_LIB, receiveLibAbi, deployer);
  
  try {
    const treasury = await receiveLib.treasury();
    console.log(`Receive library treasury: ${treasury}`);
    
    const endpoint = await receiveLib.endpoint();
    console.log(`Receive library endpoint: ${endpoint}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 80)}`);
  }
  
  // Check the executor contract we found
  console.log("\n=== CHECKING EXECUTOR CONTRACT ===");
  const executorAddr = "0xc097ab8CD7b053326DFe9fB3E3a31a0CCe3B526f";
  
  const executorAbi = [
    "function owner() view returns (address)",
    "function endpoint() view returns (address)",
    "function defaultMultiplierBps() view returns (uint256)",
  ];
  
  const executor = new ethers.Contract(executorAddr, executorAbi, deployer);
  
  try {
    const owner = await executor.owner();
    console.log(`Executor owner: ${owner}`);
  } catch (e) {
    console.log("No owner function");
  }
  
  try {
    const ep = await executor.endpoint();
    console.log(`Executor endpoint: ${ep}`);
  } catch (e) {
    console.log("No endpoint function");
  }
  
  // Transfer test - just log what we'd do
  console.log("\n=== EXECUTOR NEEDS FUNDS ===");
  const balance = await deployer.provider!.getBalance(executorAddr);
  console.log(`Current balance: ${ethers.utils.formatEther(balance)} S`);
  
  if (balance.eq(0)) {
    console.log("The executor has 0 balance - this could be why messages aren't executing!");
    console.log("\nNote: LayerZero executors are usually funded by LayerZero Labs.");
    console.log("But if this is a permissionless executor, it may need funding.");
  }
}

main().catch(console.error);
