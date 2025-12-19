import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const RECEIVE_LIB = "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== SEARCHING FOR SONIC EXECUTOR ===\n");
  
  // Try to read executor from the receive library directly
  const receiveLibAbi = [
    "function executorConfigs(address, uint32) view returns (uint32, address)",
    "function getExecutorConfig(address, uint32) view returns (tuple(uint32, address))",
    "function defaultExecutorConfigs(uint32) view returns (uint32, address)",
  ];
  
  const lib = new ethers.Contract(RECEIVE_LIB, receiveLibAbi, deployer);
  
  try {
    const [maxSize, executor] = await lib.executorConfigs(HUB, 30110);
    console.log(`Hub executor config: maxSize=${maxSize}, executor=${executor}`);
    
    const bal = await deployer.provider!.getBalance(executor);
    console.log(`Executor balance: ${ethers.utils.formatEther(bal)} S`);
  } catch (e: any) {
    console.log(`executorConfigs failed: ${e.message?.substring(0, 60)}`);
  }
  
  try {
    const [maxSize, executor] = await lib.defaultExecutorConfigs(30110);
    console.log(`Default executor config: maxSize=${maxSize}, executor=${executor}`);
    
    const bal = await deployer.provider!.getBalance(executor);
    console.log(`Executor balance: ${ethers.utils.formatEther(bal)} S`);
  } catch (e: any) {
    console.log(`defaultExecutorConfigs failed: ${e.message?.substring(0, 60)}`);
  }
  
  // Check the endpoint for executor info
  console.log("\n=== LZ ENDPOINT CONFIG ===");
  
  const endpointAbi = [
    "function delegates(address) view returns (address)",
    "function nativeToken() view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(LZ_ENDPOINT_SONIC, endpointAbi, deployer);
  
  try {
    const nativeToken = await endpoint.nativeToken();
    console.log(`Native token: ${nativeToken}`);
  } catch (e) {
    console.log("No nativeToken function");
  }
  
  // Check some addresses that might be executors based on LZ patterns
  console.log("\n=== CHECKING POTENTIAL EXECUTOR ADDRESSES ===");
  
  // These are common patterns for LZ executor addresses
  const checkAddresses = [
    "0x173272739Bd7Aa6e4e214714048a9fE699453059", // Ethereum executor
    "0x31CAe3B7fB82d847621859fb1585353c5720660D", // Arbitrum executor
    "0xc097ab8CD7b053326DFe9fB3E3a31a0CCe3B526f", // Another common one
  ];
  
  for (const addr of checkAddresses) {
    try {
      const code = await deployer.provider!.getCode(addr);
      const bal = await deployer.provider!.getBalance(addr);
      console.log(`${addr}: code=${code.length > 2 ? 'YES' : 'NO'}, balance=${ethers.utils.formatEther(bal)} S`);
    } catch (e) {
      console.log(`${addr}: error`);
    }
  }
}

main().catch(console.error);
