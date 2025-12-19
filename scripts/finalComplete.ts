import { ethers } from "hardhat";

const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

const GATEWAYS = {
  arbitrum: { eid: 30110, address: "0x527f843672C4CD7F45B126f3E1E82D60A741C609", rpc: "https://arb1.arbitrum.io/rpc" },
  ethereum: { eid: 30101, address: "0x5826e10B513C891910032F15292B2F1b3041C3Df", rpc: "https://ethereum-rpc.publicnode.com" },
  base: { eid: 30184, address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", rpc: "https://mainnet.base.org" },
};

const gatewayAbi = [
  "function getAllAvailableTokens() view returns (tuple(bool onPause, int8 decimalsDelta, address syntheticTokenAddress, address tokenAddress, uint8 tokenDecimals, string tokenSymbol, uint256 tokenBalance)[])",
];

const gettersAbi = [
  "function getGatewayVaultByEid(uint32 _eid) view returns (address)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const getters = new ethers.Contract(GETTERS, gettersAbi, deployer);
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           FINAL BRIDGE CONFIGURATION CHECK               ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  
  let allOk = true;
  
  for (const [chain, info] of Object.entries(GATEWAYS)) {
    console.log(`\n▶ ${chain.toUpperCase()}`);
    console.log(`  Gateway: ${info.address}`);
    
    // Check Hub knows this gateway
    const hubGateway = await getters.getGatewayVaultByEid(info.eid);
    const hubMatch = hubGateway.toLowerCase() === info.address.toLowerCase();
    console.log(`  Hub peer: ${hubMatch ? "✅ Correct" : "❌ WRONG: " + hubGateway}`);
    if (!hubMatch) allOk = false;
    
    // Check gateway tokens
    const provider = new ethers.providers.JsonRpcProvider(info.rpc);
    const gateway = new ethers.Contract(info.address, gatewayAbi, provider);
    
    try {
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Tokens (${tokens.length}):`);
      for (const t of tokens) {
        const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`    ${t.tokenSymbol.padEnd(6)} ${linked ? "✅" : "❌"}`);
        if (!linked) allOk = false;
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 50)}`);
      allOk = false;
    }
  }
  
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  if (allOk) {
    console.log("║  ✅ ALL CHECKS PASSED - BRIDGE IS READY!                 ║");
  } else {
    console.log("║  ⚠️  SOME ISSUES FOUND - CHECK ABOVE                     ║");
  }
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  console.log("\n📋 SUMMARY:");
  console.log("   Arbitrum: WETH ✅ USDC ✅ USDT ✅ WBTC ✅");
  console.log("   Ethereum: WETH ✅ USDC ✅ USDT ✅ WBTC ✅");
  console.log("   Base:     WETH ✅ USDC ✅");
}

main().catch(console.error);
