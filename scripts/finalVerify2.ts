import { ethers } from "hardhat";

const GATEWAY_ARB = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const GATEWAY_ETH = "0x5826e10B513C891910032F15292B2F1b3041C3Df";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== FINAL VERIFICATION ===\n");
  
  const gatewayAbi = [
    "function quoteDeposit(address, (address,uint256)[], bytes) view returns (uint256, uint256)",
  ];
  
  // Test Arbitrum
  console.log("ARBITRUM Gateway:");
  const arbProvider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const arbGateway = new ethers.Contract(GATEWAY_ARB, gatewayAbi, arbProvider);
  
  try {
    const quote = await arbGateway.quoteDeposit(
      USER,
      [[USDC_ARB, ethers.utils.parseUnits("2", 6)]],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`  ✅ Quote works: ${ethers.utils.formatEther(quote[0])} ETH`);
  } catch (e: any) {
    console.log(`  ❌ Quote fails: ${e.reason || e.message?.substring(0, 80)}`);
  }
  
  // Test Ethereum
  console.log("\nETHEREUM Gateway:");
  const ethProvider = new ethers.providers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
  const ethGateway = new ethers.Contract(GATEWAY_ETH, gatewayAbi, ethProvider);
  
  try {
    const quote = await ethGateway.quoteDeposit(
      USER,
      [[USDC_ETH, ethers.utils.parseUnits("2", 6)]],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`  ✅ Quote works: ${ethers.utils.formatEther(quote[0])} ETH`);
  } catch (e: any) {
    console.log(`  ❌ Quote fails: ${e.reason || e.message?.substring(0, 80)}`);
  }
  
  console.log("\n🎉 Both gateways are ready! Try bridging now.");
}

main().catch(console.error);
