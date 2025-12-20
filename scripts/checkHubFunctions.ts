import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  console.log("=== CHECKING HUB FUNCTIONS ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Function selectors to check
  const functions = [
    { name: "adminRescueFromGateway", selector: "0x" + ethers.utils.id("adminRescueFromGateway(uint32,address,(address,uint256)[],bytes)").slice(2, 10) },
    { name: "quoteAdminRescue", selector: "0x" + ethers.utils.id("quoteAdminRescue(uint32,address,(address,uint256)[],bytes)").slice(2, 10) },
    { name: "createSyntheticToken", selector: "0x" + ethers.utils.id("createSyntheticToken(string,uint8)").slice(2, 10) },
    { name: "setBalancer", selector: "0x" + ethers.utils.id("setBalancer(address)").slice(2, 10) },
  ];
  
  const hubCode = await provider.getCode(HUB);
  console.log(`Hub code length: ${hubCode.length}`);
  
  for (const fn of functions) {
    // Check if selector exists in bytecode
    const selectorHex = fn.selector.slice(2);
    const exists = hubCode.toLowerCase().includes(selectorHex.toLowerCase());
    console.log(`${fn.name} (${fn.selector}): ${exists ? "✅ EXISTS" : "❌ NOT FOUND"}`);
  }
}

main().catch(console.error);
