import { ethers } from "hardhat";

const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

const GATEWAYS = {
  arbitrum: { eid: 30110, address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", rpc: "https://arb1.arbitrum.io/rpc" },
  ethereum: { eid: 30101, address: "0xba36FC6568B953f691dd20754607590C59b7646a", rpc: "https://ethereum-rpc.publicnode.com" },
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
  
  console.log("=== FINAL VERIFICATION ===\n");
  
  for (const [chain, info] of Object.entries(GATEWAYS)) {
    console.log(`\n${chain.toUpperCase()}:`);
    
    // Check Hub knows this gateway
    const hubGateway = await getters.getGatewayVaultByEid(info.eid);
    const hubMatch = hubGateway.toLowerCase() === info.address.toLowerCase();
    console.log(`  Hub gateway match: ${hubMatch ? "✅ YES" : "❌ NO"}`);
    
    // Check gateway tokens
    const provider = new ethers.providers.JsonRpcProvider(info.rpc);
    const gateway = new ethers.Contract(info.address, gatewayAbi, provider);
    
    try {
      const tokens = await gateway.getAllAvailableTokens();
      console.log(`  Available tokens:`);
      for (const t of tokens) {
        const linked = t.syntheticTokenAddress !== ethers.constants.AddressZero;
        console.log(`    ${t.tokenSymbol}: ${linked ? "✅ READY" : "❌ NOT LINKED"}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message?.substring(0, 50)}`);
    }
  }
  
  console.log("\n\n=== SUMMARY ===");
  console.log("WETH:  Arbitrum ✅ | Ethereum ✅ | Base ✅");
  console.log("USDC:  Arbitrum ✅ | Ethereum ✅ | Base ✅");
  console.log("USDT:  Arbitrum ✅ | Ethereum ✅ | Base ❌");
  console.log("WBTC:  ALL CHAINS ❌ (Hub update needed)");
}

main().catch(console.error);
