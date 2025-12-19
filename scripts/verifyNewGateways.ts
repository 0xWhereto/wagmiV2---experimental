import { ethers } from "hardhat";

const GATEWAYS = {
  arbitrum: { address: "0x87D26048e94Cb62fad640F59054f7502dFE6209f", rpc: "https://arb1.arbitrum.io/rpc" },
  ethereum: { address: "0xBb34D03d6110c079858B3Dd71F3791647b8F62cf", rpc: "https://ethereum-rpc.publicnode.com" },
};

const gatewayAbi = [
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  console.log("=== Verifying New Gateways ===\n");

  for (const [chain, config] of Object.entries(GATEWAYS)) {
    console.log(`\n${chain.toUpperCase()}: ${config.address}`);
    
    const provider = new ethers.providers.JsonRpcProvider(config.rpc);
    const gateway = new ethers.Contract(config.address, gatewayAbi, provider);
    
    try {
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Tokens registered: ${tokens.length}`);
      
      for (const t of tokens) {
        const hasValidSynthetic = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        const status = hasValidSynthetic ? "✅ READY" : "❌ NOT LINKED";
        console.log(`  ${t.tokenSymbol}: ${status}`);
        if (hasValidSynthetic) {
          console.log(`    Local: ${t.tokenAddress}`);
          console.log(`    Synthetic: ${t.syntheticTokenAddress}`);
        }
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
