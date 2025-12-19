import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  const code = await deployer.provider!.getCode(HUB_ADDRESS);
  
  // Check for bridgeTokens function
  const iface = new ethers.utils.Interface([
    "function bridgeTokens(address recipient, tuple(address tokenAddress, uint256 tokenAmount)[] assets, uint32 dstEid, bytes options)",
    "function quoteBridgeTokens(address recipient, tuple(address tokenAddress, uint256 tokenAmount)[] assets, uint32 dstEid, bytes options)",
  ]);
  
  const bridgeSelector = iface.getSighash("bridgeTokens");
  const quoteSelector = iface.getSighash("quoteBridgeTokens");
  
  console.log("=== Checking Hub for bridge functions ===\n");
  console.log(`bridgeTokens selector: ${bridgeSelector}`);
  console.log(`  In Hub bytecode: ${code.toLowerCase().includes(bridgeSelector.substring(2).toLowerCase())}`);
  console.log();
  console.log(`quoteBridgeTokens selector: ${quoteSelector}`);
  console.log(`  In Hub bytecode: ${code.toLowerCase().includes(quoteSelector.substring(2).toLowerCase())}`);
  
  // Also check what functions are in the Hub by looking at common selectors
  const functionsToCheck = [
    { name: "setPeer", sig: "function setPeer(uint32,bytes32)" },
    { name: "createSyntheticToken", sig: "function createSyntheticToken(string,uint8)" },
    { name: "withdrawTo", sig: "function withdrawTo(address,address,uint256,uint32,bytes)" },
    { name: "withdraw", sig: "function withdraw(address,uint256,uint32,bytes)" },
    { name: "bridgeBack", sig: "function bridgeBack(address,address,uint256,uint32,bytes)" },
  ];
  
  console.log("\n=== Other functions ===");
  for (const f of functionsToCheck) {
    try {
      const iface2 = new ethers.utils.Interface([f.sig]);
      const sel = iface2.getSighash(f.name);
      console.log(`${f.name}: ${sel} - ${code.toLowerCase().includes(sel.substring(2).toLowerCase()) ? "EXISTS" : "NOT FOUND"}`);
    } catch (e) {
      console.log(`${f.name}: Error computing selector`);
    }
  }
}

main().catch(console.error);
