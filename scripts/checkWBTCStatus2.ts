import { ethers } from "hardhat";

const ARBITRUM_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC_ARBITRUM = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== CHECKING WBTC STATUS ===\n");
  
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const gatewayAbi = [
    "function getAvailableTokenLength() view returns (uint256)",
    "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
    "function getTokenIndex(address) view returns (uint256)",
  ];
  
  const gateway = new ethers.Contract(ARBITRUM_GATEWAY, gatewayAbi, arbProvider);
  
  try {
    // Check if WBTC is registered
    console.log("--- Checking if WBTC is registered ---");
    try {
      const wbtcIndex = await gateway.getTokenIndex(WBTC_ARBITRUM);
      console.log(`WBTC index: ${wbtcIndex}`);
      if (wbtcIndex.gt(0)) {
        console.log("✅ WBTC is registered on Arbitrum Gateway");
      }
    } catch (e) {
      console.log("❌ WBTC is NOT registered on Arbitrum Gateway");
    }
    
    // Get all tokens
    console.log("\n--- All tokens on Gateway ---");
    const allTokens = await gateway.getAllAvailableTokens();
    console.log(`Total tokens: ${allTokens.length}`);
    
    for (let i = 0; i < allTokens.length; i++) {
      const t = allTokens[i];
      console.log(`\n[${i}] ${t.tokenSymbol}:`);
      console.log(`    Token: ${t.tokenAddress}`);
      console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
      console.log(`    Decimals: ${t.tokenDecimals}`);
      console.log(`    Paused: ${t.onPause}`);
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
