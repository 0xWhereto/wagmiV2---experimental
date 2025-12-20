import { ethers } from "hardhat";

// Contract addresses
const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

// WBTC addresses
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

// EIDs
const ARBITRUM_EID = 30110;

async function main() {
  console.log("=== CHECKING WBTC BRIDGE STATUS ===\n");
  
  // Check Hub for sWBTC
  console.log("--- Checking Hub (Sonic) ---");
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const hubGettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenByIndex(uint256) view returns (address, string, uint8, uint32[])",
  ];
  
  // Use the getters contract
  const GETTERS_ADDRESS = "0xYourGettersAddress"; // We'll check this differently
  
  // Let's check the gateway instead
  console.log("\n--- Checking Arbitrum Gateway ---");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const gatewayAbi = [
    "function getAvailableTokenLength() view returns (uint256)",
    "function availableTokens(uint256) view returns (bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)",
  ];
  
  const gateway = new ethers.Contract(ARBITRUM_GATEWAY, gatewayAbi, arbProvider);
  
  try {
    const tokenCount = await gateway.getAvailableTokenLength();
    console.log(`Total tokens on Arbitrum Gateway: ${tokenCount}`);
    
    let wbtcFound = false;
    for (let i = 0; i < tokenCount; i++) {
      const token = await gateway.availableTokens(i);
      console.log(`\nToken ${i}:`);
      console.log(`  Symbol: ${token.tokenSymbol}`);
      console.log(`  Address: ${token.tokenAddress}`);
      console.log(`  Synthetic: ${token.syntheticTokenAddress}`);
      console.log(`  Decimals: ${token.tokenDecimals}`);
      console.log(`  Paused: ${token.onPause}`);
      console.log(`  Balance: ${ethers.utils.formatUnits(token.tokenBalance, token.tokenDecimals)}`);
      
      if (token.tokenSymbol === "WBTC" || token.tokenAddress.toLowerCase() === WBTC_ARBITRUM.toLowerCase()) {
        wbtcFound = true;
        console.log("  ✅ WBTC FOUND!");
      }
    }
    
    if (!wbtcFound) {
      console.log("\n❌ WBTC not found on Arbitrum Gateway - needs to be added");
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
