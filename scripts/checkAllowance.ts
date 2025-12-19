import { ethers } from "hardhat";

const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  console.log("=== CHECKING USDC ALLOWANCE ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
  
  const erc20Abi = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  
  const usdc = new ethers.Contract(USDC_ARB, erc20Abi, provider);
  
  const symbol = await usdc.symbol();
  const decimals = await usdc.decimals();
  const balance = await usdc.balanceOf(USER);
  const allowance = await usdc.allowance(USER, GATEWAY);
  
  console.log(`Token: ${symbol}`);
  console.log(`User: ${USER}`);
  console.log(`Gateway: ${GATEWAY}`);
  console.log(`\nBalance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
  console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
  
  const amountNeeded = ethers.utils.parseUnits("5", decimals); // 5 USDC from the failed tx
  console.log(`\nAmount needed: 5 ${symbol}`);
  console.log(`Sufficient allowance: ${allowance.gte(amountNeeded) ? "✅ Yes" : "❌ No"}`);
  console.log(`Sufficient balance: ${balance.gte(amountNeeded) ? "✅ Yes" : "❌ No"}`);
}

main().catch(console.error);
