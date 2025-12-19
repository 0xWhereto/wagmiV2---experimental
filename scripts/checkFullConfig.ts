import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const ENDPOINT = "0x1a44076050125825900e736c501f859c50fE728c";
const SONIC_EID = 30332;

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const endpointAbi = [
    "function getSendLibrary(address, uint32) view returns (address)",
    "function getConfig(address, address, uint32, uint32) view returns (bytes)",
    "function defaultSendLibrary(uint32) view returns (address)",
  ];
  
  const endpoint = new ethers.Contract(ENDPOINT, endpointAbi, provider);
  
  console.log("=== Full LZ Config Check for Arbitrum Gateway ===\n");
  
  const sendLib = await endpoint.getSendLibrary(GATEWAY, SONIC_EID);
  console.log(`Send library: ${sendLib}`);
  
  // Config types:
  // 1 = Executor
  // 2 = ULN (DVN) config
  
  for (const configType of [1, 2]) {
    const configName = configType === 1 ? "Executor" : "ULN/DVN";
    console.log(`\n${configName} Config (type ${configType}):`);
    
    try {
      // Check default
      const defaultLib = await endpoint.defaultSendLibrary(SONIC_EID);
      const defaultConfig = await endpoint.getConfig(ethers.constants.AddressZero, defaultLib, SONIC_EID, configType);
      console.log(`  Default: ${defaultConfig.substring(0, 80)}...`);
      
      // Check gateway
      const gwConfig = await endpoint.getConfig(GATEWAY, sendLib, SONIC_EID, configType);
      console.log(`  Gateway: ${gwConfig.substring(0, 80)}...`);
      
      if (defaultConfig === gwConfig) {
        console.log(`  ✅ Matches default`);
      } else {
        console.log(`  ⚠️ Custom config`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 80)}`);
    }
  }
  
  // Try quoteDeposit again
  console.log("\n=== Testing quoteDeposit ===");
  
  const gatewayAbi = [
    "function quoteDeposit(address, (address,uint256)[], bytes) view returns (uint256, uint256)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, provider);
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
  
  try {
    const quote = await gateway.quoteDeposit(
      USER,
      [[USDC, ethers.utils.parseUnits("2", 6)]],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`Quote: ${ethers.utils.formatEther(quote[0])} ETH`);
  } catch (e: any) {
    console.log(`Quote error: ${e.reason || e.message?.substring(0, 150)}`);
  }
}

main().catch(console.error);
