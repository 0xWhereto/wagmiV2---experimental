import { ethers } from "hardhat";

const SEND_LIB_ARB = "0x975bcD720be66659e3EB3C0e4F1866a3020E493A";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== CHECKING ARBITRUM SEND LIB FOR SONIC EXECUTOR ===\n");
  
  const sendLibAbi = [
    "function defaultExecutorConfigs(uint32) view returns (uint32 maxMessageSize, address executor)",
    "function defaultUlnConfigs(uint32) view returns (tuple(uint64, uint8, uint8, uint8, address[], address[]))",
    "function treasury() view returns (address)",
  ];
  
  const sendLib = new ethers.Contract(SEND_LIB_ARB, sendLibAbi, provider);
  
  try {
    const [maxSize, executor] = await sendLib.defaultExecutorConfigs(SONIC_EID);
    console.log(`Default executor for Sonic: ${executor}`);
    console.log(`Max message size: ${maxSize}`);
    
    // Check if this executor exists on Sonic
    const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
    const code = await sonicProvider.getCode(executor);
    const balance = await sonicProvider.getBalance(executor);
    
    console.log(`\nExecutor on Sonic:`);
    console.log(`  Has code: ${code.length > 2}`);
    console.log(`  Balance: ${ethers.utils.formatEther(balance)} S`);
    
    if (code.length <= 2) {
      console.log("\n⚠️ The executor contract doesn't exist on Sonic!");
      console.log("This is a LayerZero infrastructure issue.");
    } else if (balance.eq(0)) {
      console.log("\n⚠️ The executor has 0 balance!");
      console.log("It might need S to pay for gas when executing lzReceive.");
    }
    
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 100)}`);
  }
  
  // Check treasury
  try {
    const treasury = await sendLib.treasury();
    console.log(`\nTreasury: ${treasury}`);
  } catch (e) {
    console.log("No treasury function");
  }
}

main().catch(console.error);
