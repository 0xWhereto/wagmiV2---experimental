import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Testing Quote NOW ===\n");
  
  const gatewayAbi = [
    "function quoteDeposit(address, (address,uint256)[], bytes) view returns (uint256, uint256)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, provider);
  
  try {
    const quote = await gateway.quoteDeposit(
      USER,
      [[USDC, ethers.utils.parseUnits("2", 6)]],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`✅ Quote: ${ethers.utils.formatEther(quote[0])} ETH`);
    console.log(`\n🎉 Bridge should work now! Try again.`);
  } catch (e: any) {
    console.log(`❌ Still failing: ${e.reason || e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);
