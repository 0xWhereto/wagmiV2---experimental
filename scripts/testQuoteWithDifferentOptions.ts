import { ethers } from "hardhat";

const GATEWAY = "0x527f843672C4CD7F45B126f3E1E82D60A741C609";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  console.log("=== Testing Quote with Different Options ===\n");
  
  const gatewayAbi = [
    "function quoteDeposit(address, (address,uint256)[], bytes) view returns (uint256, uint256)",
  ];
  
  const gateway = new ethers.Contract(GATEWAY, gatewayAbi, provider);
  
  const optionVariants = [
    { name: "Empty options", options: "0x" },
    { name: "Type 3 with 500k gas", options: "0x0003010011010000000000000000000000000007a120" },
    { name: "Type 3 with 100k gas", options: "0x000301001101000000000000000000000000000186a0" },
  ];
  
  for (const variant of optionVariants) {
    console.log(`\n${variant.name}: ${variant.options}`);
    try {
      const quote = await gateway.quoteDeposit(
        USER,
        [[USDC, ethers.utils.parseUnits("2", 6)]],
        variant.options
      );
      console.log(`  ✅ Quote: ${ethers.utils.formatEther(quote[0])} ETH`);
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.reason || e.message?.substring(0, 100)}`);
    }
  }
  
  // Check if the OLD gateway works
  console.log("\n\n=== Testing OLD Gateway (for comparison) ===");
  const OLD_GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
  const oldGateway = new ethers.Contract(OLD_GATEWAY, gatewayAbi, provider);
  
  try {
    const quote = await oldGateway.quoteDeposit(
      USER,
      [[USDC, ethers.utils.parseUnits("2", 6)]],
      "0x0003010011010000000000000000000000000007a120"
    );
    console.log(`✅ OLD Gateway Quote: ${ethers.utils.formatEther(quote[0])} ETH`);
  } catch (e: any) {
    console.log(`❌ OLD Gateway Error: ${e.reason || e.message?.substring(0, 100)}`);
  }
}

main().catch(console.error);
