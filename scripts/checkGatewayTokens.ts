import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";

async function main() {
  console.log("=== Check Gateway Tokens ===");
  
  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
  
  // Get all available tokens
  const tokens = await gateway.getAllAvailableTokens();
  console.log("Linked tokens:", tokens.length);
  
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    console.log(`\n[${i}] ${t.tokenSymbol}`);
    console.log(`  Original token: ${t.tokenAddress}`);
    console.log(`  Synthetic address: ${t.syntheticTokenAddress}`);
    console.log(`  Decimals delta: ${t.decimalsDelta}`);
    console.log(`  Paused: ${t.onPause}`);
    console.log(`  Balance: ${t.tokenBalance.toString()}`);
  }
}

main().catch(console.error);
