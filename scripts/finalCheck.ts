import { ethers } from "hardhat";

const GATEWAYS = {
  arbitrum: { address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609", rpc: "https://arb1.arbitrum.io/rpc" },
  ethereum: { address: "0x5826e10B513C891910032F15292B2F1b3041C3Df", rpc: "https://ethereum-rpc.publicnode.com" },
  base: { address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", rpc: "https://mainnet.base.org" },
};

const gatewayAbi = [
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

async function main() {
  console.log("=== FINAL GATEWAY CHECK ===\n");
  
  for (const [chain, config] of Object.entries(GATEWAYS)) {
    console.log(`${chain.toUpperCase()}: ${config.address}`);
    
    const provider = new ethers.providers.JsonRpcProvider(config.rpc);
    const gateway = new ethers.Contract(config.address, gatewayAbi, provider);
    
    try {
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Tokens: ${tokens.length}`);
      
      for (const t of tokens) {
        const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`    ${t.tokenSymbol}: ${linked ? "✅" : "❌"}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 50)}`);
    }
    console.log();
  }
  
  console.log("\n=== UPDATE FRONTEND CONFIG ===\n");
  console.log(`arbitrum.gatewayVault = "0x527f843672C4CD7F45B126f3E1E82D60A741C609"`);
  console.log(`ethereum.gatewayVault = "0x5826e10B513C891910032F15292B2F1b3041C3Df"`);
  console.log(`base.gatewayVault = "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb"`);
}

main().catch(console.error);
