import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== CHECKING WBTC MIN BRIDGE ON OLD GATEWAY ===\n");
  
  const gateway = await ethers.getContractAt("GatewayVault", OLD_GATEWAY);
  
  const tokenInfo = await gateway.getAllAvailableTokenByAddress(WBTC);
  console.log("WBTC on Old Gateway:");
  console.log(`  Token: ${tokenInfo.tokenAddress}`);
  console.log(`  Synthetic: ${tokenInfo.syntheticTokenAddress}`);
  console.log(`  Decimals: ${tokenInfo.tokenDecimals}`);
  console.log(`  Paused: ${tokenInfo.onPause}`);
  console.log(`  Balance: ${tokenInfo.tokenBalance}`);
  
  // The minBridgeAmt might be stored differently
  // Let's check via availableTokens directly
  const index = await gateway.getTokenIndex(WBTC);
  console.log(`  Index: ${index}`);
  
  const allTokens = await gateway.getAllAvailableTokens();
  const wbtcToken = allTokens[index.toNumber()];
  console.log(`\nRaw token data:`);
  console.log(`  onPause: ${wbtcToken.onPause}`);
  console.log(`  decimalsDelta: ${wbtcToken.decimalsDelta}`);
  console.log(`  syntheticTokenAddress: ${wbtcToken.syntheticTokenAddress}`);
  console.log(`  tokenAddress: ${wbtcToken.tokenAddress}`);
  console.log(`  tokenDecimals: ${wbtcToken.tokenDecimals}`);
  console.log(`  tokenBalance: ${wbtcToken.tokenBalance}`);
}

main().catch(console.error);
