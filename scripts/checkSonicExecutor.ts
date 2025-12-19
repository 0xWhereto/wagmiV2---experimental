import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CHECKING SONIC EXECUTOR ===\n");
  
  // The executor on the destination chain (Sonic) is what actually calls lzReceive
  // Let's find out what executor is configured
  
  const endpointAbi = [
    "function getReceiveLibrary(address, uint32) view returns (address, bool)",
    "function defaultReceiveLibrary(uint32) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  // Get receive library
  const [receiveLib] = await endpoint.getReceiveLibrary(HUB, ARB_EID);
  console.log(`Receive library: ${receiveLib}`);
  
  // The receive library's executor config
  const receiveLibAbi = [
    "function getExecutorConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint32 maxMessageSize, address executor))",
  ];
  
  try {
    const lib = new ethers.Contract(receiveLib, receiveLibAbi, deployer);
    const execConfig = await lib.getExecutorConfig(HUB, ARB_EID);
    console.log(`Executor on Sonic: ${execConfig.executor}`);
    
    // Check executor balance
    const balance = await deployer.provider!.getBalance(execConfig.executor);
    console.log(`Executor balance: ${ethers.utils.formatEther(balance)} S`);
    
    if (balance.lt(ethers.utils.parseEther("1"))) {
      console.log("\n⚠️ Executor has low balance!");
    }
  } catch (e: any) {
    console.log(`Error getting executor config: ${e.message?.substring(0, 100)}`);
  }
  
  // Also check the default executor
  console.log("\n=== DEFAULT LZ EXECUTOR ON SONIC ===");
  
  // Known LayerZero executor addresses
  const knownExecutors = [
    "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4", // Common LZ executor
    "0x0BbC0b1bfAb6ECc68D57bE4aAB5d8df7D16E23C1", // Another common one
  ];
  
  for (const exec of knownExecutors) {
    const bal = await deployer.provider!.getBalance(exec);
    console.log(`${exec}: ${ethers.utils.formatEther(bal)} S`);
  }
  
  // Check LZ endpoint default receive library executor
  const defaultLib = await endpoint.defaultReceiveLibrary(ARB_EID);
  console.log(`\nDefault receive library for Arbitrum: ${defaultLib}`);
}

main().catch(console.error);
