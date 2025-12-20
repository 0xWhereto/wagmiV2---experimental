import { ethers } from "hardhat";

const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== CHECKING WBTC MINIMUM BRIDGE AMOUNT ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Get the availableTokens array for WBTC
  // AvailableToken struct: onPause, tokenAddress, syntheticTokenAddress, decimalsDelta, minBridgeAmt
  const gatewayAbi = [
    "function availableTokens(uint256) view returns (bool onPause, address tokenAddress, address syntheticTokenAddress, int8 decimalsDelta, uint256 minBridgeAmt)",
    "function getTokenIndex(address) view returns (uint256)",
  ];
  
  const gateway = new ethers.Contract(OLD_GATEWAY, gatewayAbi, provider);
  
  const index = await gateway.getTokenIndex(WBTC);
  console.log(`WBTC index: ${index}`);
  
  const token = await gateway.availableTokens(index);
  console.log(`WBTC on Gateway:`);
  console.log(`  onPause: ${token.onPause}`);
  console.log(`  tokenAddress: ${token.tokenAddress}`);
  console.log(`  syntheticTokenAddress: ${token.syntheticTokenAddress}`);
  console.log(`  decimalsDelta: ${token.decimalsDelta}`);
  console.log(`  minBridgeAmt: ${token.minBridgeAmt} (${ethers.utils.formatUnits(token.minBridgeAmt, 8)} WBTC)`);
  
  // The user tried 3000 sats = 0.00003 WBTC
  console.log(`\nUser tried: 3000 sats = 0.00003 WBTC`);
  console.log(`Minimum: ${token.minBridgeAmt} sats = ${ethers.utils.formatUnits(token.minBridgeAmt, 8)} WBTC`);
  
  if (token.minBridgeAmt.gt(3000)) {
    console.log("\n❌ User amount is below minimum!");
    console.log(`Need at least ${ethers.utils.formatUnits(token.minBridgeAmt, 8)} WBTC to bridge`);
  }
}

main().catch(console.error);
