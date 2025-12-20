import { ethers } from "hardhat";

async function main() {
  const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  // Get the code at Gateway
  const code = await provider.getCode(GATEWAY);
  console.log(`Gateway ${GATEWAY}`);
  console.log(`  Has code: ${code.length > 2 ? "YES" : "NO"}`);
  
  // Check USDC balance
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
  const balance = await usdc.balanceOf(GATEWAY);
  console.log(`  USDC balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);
  
  // Let me also check if there's a transaction that withdrew the 30 USDC after I deposited
  console.log("\n=== Checking block explorer for recent Gateway transactions ===");
  
  // Get recent blocks since my tx (block 412737968)
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  console.log(`My tx was at block: 412737968`);
  console.log(`Blocks since: ${latestBlock - 412737968}`);
}

main().catch(console.error);
