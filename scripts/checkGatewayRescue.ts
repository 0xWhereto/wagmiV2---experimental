import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  console.log("=== CHECKING GATEWAY FUNCTIONS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  
  const functions = [
    { name: "rescueTokens", selector: ethers.utils.id("rescueTokens(address,address,uint256)").slice(0, 10) },
    { name: "rescueAllTokens", selector: ethers.utils.id("rescueAllTokens(address,address)").slice(0, 10) },
    { name: "owner", selector: ethers.utils.id("owner()").slice(0, 10) },
  ];
  
  const gatewayCode = await provider.getCode(GATEWAY);
  console.log(`Gateway code length: ${gatewayCode.length}`);
  
  for (const fn of functions) {
    const selectorHex = fn.selector.slice(2);
    const exists = gatewayCode.toLowerCase().includes(selectorHex.toLowerCase());
    console.log(`${fn.name} (${fn.selector}): ${exists ? "✅ EXISTS" : "❌ NOT FOUND"}`);
  }
}

main().catch(console.error);
