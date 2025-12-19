import { ethers } from "hardhat";

const GATEWAYS = {
  arbitrum: { 
    new: "0x87D26048e94Cb62fad640F59054f7502dFE6209f",
    old: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e",
    rpc: "https://arb1.arbitrum.io/rpc" 
  },
  ethereum: { 
    new: "0xBb34D03d6110c079858B3Dd71F3791647b8F62cf",
    old: "0xba36FC6568B953f691dd20754607590C59b7646a",
    rpc: "https://ethereum-rpc.publicnode.com" 
  },
};

const gatewayAbi = [
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  console.log("=== Full Gateway Verification ===\n");

  for (const [chain, config] of Object.entries(GATEWAYS)) {
    console.log(`\n=== ${chain.toUpperCase()} ===`);
    const provider = new ethers.providers.JsonRpcProvider(config.rpc);
    
    // Check NEW gateway
    console.log(`\nNEW Gateway: ${config.new}`);
    try {
      const gateway = new ethers.Contract(config.new, gatewayAbi, provider);
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Tokens: ${tokens.length}`);
      for (const t of tokens) {
        const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`  - ${t.tokenSymbol}: ${linked ? "✅" : "❌"} ${t.tokenAddress}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 60)}`);
    }

    // Check OLD gateway
    console.log(`\nOLD Gateway: ${config.old}`);
    try {
      const gateway = new ethers.Contract(config.old, gatewayAbi, provider);
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Tokens: ${tokens.length}`);
      for (const t of tokens) {
        const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`  - ${t.tokenSymbol}: ${linked ? "✅" : "❌"} ${t.tokenAddress}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 60)}`);
    }
  }
}

main().catch(console.error);
