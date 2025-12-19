import { ethers } from "hardhat";

const GATEWAY_ARB = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const GATEWAY_ETH = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const OLD_GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const SONIC_EID = 30332;

async function checkExecutor(name: string, rpc: string, endpoint: string, gateway: string) {
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
  ];
  
  const ep = new ethers.Contract(endpoint, endpointAbi, provider);
  
  console.log(`\n${name}:`);
  console.log(`  Gateway: ${gateway}`);
  
  try {
    const sendLib = await ep.getSendLibrary(gateway, SONIC_EID);
    console.log(`  Send library: ${sendLib}`);
    
    // Get executor config (type 1)
    const execConfig = await ep.getConfig(gateway, sendLib, SONIC_EID, 1);
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      execConfig
    );
    console.log(`  Executor: ${decoded[0].executor}`);
    console.log(`  Max message size: ${decoded[0].maxMessageSize}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message?.substring(0, 80)}`);
  }
}

async function main() {
  console.log("=== EXECUTOR CONFIGURATION CHECK ===");
  
  const LZ_ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
  
  await checkExecutor("NEW Arbitrum Gateway", "https://arb1.arbitrum.io/rpc", LZ_ENDPOINT, GATEWAY_ARB);
  await checkExecutor("OLD Arbitrum Gateway", "https://arb1.arbitrum.io/rpc", LZ_ENDPOINT, OLD_GATEWAY_ARB);
  await checkExecutor("NEW Ethereum Gateway", "https://ethereum-rpc.publicnode.com", LZ_ENDPOINT, GATEWAY_ETH);
  
  console.log("\n\n=== POSSIBLE ISSUE ===");
  console.log("If the executor doesn't support Sonic (chain 146), messages will get stuck.");
  console.log("The LayerZero executor must be configured to relay to Sonic.");
}

main().catch(console.error);
