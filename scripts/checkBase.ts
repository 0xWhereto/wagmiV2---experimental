import { ethers } from "hardhat";

const BASE_GATEWAY = "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  
  const gatewayAbi = [
    "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
  ];
  
  console.log("=== Base Gateway ===");
  console.log(`Address: ${BASE_GATEWAY}\n`);
  
  const gateway = new ethers.Contract(BASE_GATEWAY, gatewayAbi, provider);
  
  try {
    const tokens = await gateway.getAllAvailableTokens();
    console.log(`Tokens: ${tokens.length}`);
    for (const t of tokens) {
      const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
      console.log(`  ${t.tokenSymbol}: ${linked ? "✅" : "❌"} ${t.tokenAddress}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.substring(0, 80)}`);
  }
}

main().catch(console.error);
