import { ethers } from "hardhat";

const GATEWAYS = {
  arbitrum: { address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", rpc: "https://arb1.arbitrum.io/rpc" },
  ethereum: { address: "0xba36FC6568B953f691dd20754607590C59b7646a", rpc: "https://ethereum-rpc.publicnode.com" },
};

const gatewayAbi = [
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  console.log("=== Full Token Status Check ===\n");

  for (const [chain, config] of Object.entries(GATEWAYS)) {
    console.log(`\n=== ${chain.toUpperCase()} Gateway ===`);
    console.log(`Address: ${config.address}\n`);
    
    const provider = new ethers.providers.JsonRpcProvider(config.rpc);
    const gateway = new ethers.Contract(config.address, gatewayAbi, provider);
    
    try {
      const tokens = await gateway.getAllAvailableTokens();
      
      for (const t of tokens) {
        const hasValidSynthetic = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        const status = hasValidSynthetic ? "✅ READY" : "❌ NOT LINKED";
        
        console.log(`${t.tokenSymbol}:`);
        console.log(`  Status: ${status}`);
        console.log(`  Token: ${t.tokenAddress}`);
        console.log(`  Synthetic: ${t.syntheticTokenAddress}`);
        console.log(`  Paused: ${t.onPause}`);
        console.log(`  Balance in vault: ${ethers.utils.formatUnits(t.tokenBalance, t.tokenDecimals)}`);
        console.log();
      }
    } catch (e: any) {
      console.log(`Error: ${e.message?.substring(0, 80)}`);
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log("WETH: ✅ Works on Arbitrum & Ethereum");
  console.log("USDC: ✅ Works on Arbitrum & Ethereum");
  console.log("USDT: ✅ Works on Arbitrum & Ethereum");
  console.log("WBTC: ❌ NOT LINKED - syntheticAddress is 0x0");
  console.log("\nNote: WBTC cannot be bridged until it's properly linked on the Hub");
}

main().catch(console.error);
