import { ethers } from "hardhat";

async function main() {
  // Try different signatures to find the matching selector 0xd441f6c8
  const signatures = [
    "function bridgeTokens(address,tuple(address,uint256)[],uint32,bytes)",
    "function bridgeTokens(tuple(address,uint256)[],address,uint32,bytes)",
    "function bridgeTokens(uint32,address,tuple(address,uint256)[],bytes)",
    "function bridgeTokens(address,uint32,tuple(address,uint256)[],bytes)",
    "function bridgeTokens(tuple(address tokenAddress, uint256 tokenAmount)[] _assets, address _recipient, uint32 _dstEid, bytes _options)",
    "function bridgeTokens(address _syntheticToken, uint256 _amount, address _recipient, uint32 _dstEid, bytes _options)",
    "function bridgeTokens(address,uint256,address,uint32,bytes)",
  ];

  console.log("Looking for signature that produces selector 0xd441f6c8:\n");

  for (const sig of signatures) {
    try {
      const iface = new ethers.utils.Interface([sig]);
      const sel = iface.getSighash("bridgeTokens");
      console.log(`${sel}: ${sig}`);
      if (sel === "0xd441f6c8") {
        console.log("  ^^ MATCH FOUND! ^^");
      }
    } catch (e: any) {
      console.log(`Error: ${sig} - ${e.message?.substring(0, 50)}`);
    }
  }

  // Also check quote function
  console.log("\n\nLooking for quoteBridgeTokens (0xc7760500):\n");
  const quoteSignatures = [
    "function quoteBridgeTokens(address,tuple(address,uint256)[],uint32,bytes)",
    "function quoteBridgeTokens(tuple(address,uint256)[],address,uint32,bytes)",
    "function quoteBridgeTokens(address,uint256,uint32,bytes)",
    "function quoteBridgeTokens(tuple(address tokenAddress, uint256 tokenAmount)[] _assets, address _recipient, uint32 _dstEid, bytes _options)",
  ];

  for (const sig of quoteSignatures) {
    try {
      const iface = new ethers.utils.Interface([sig]);
      const sel = iface.getSighash("quoteBridgeTokens");
      console.log(`${sel}: ${sig}`);
      if (sel === "0xc7760500") {
        console.log("  ^^ MATCH FOUND! ^^");
      }
    } catch (e: any) {
      console.log(`Error: ${sig} - ${e.message?.substring(0, 50)}`);
    }
  }
}

main().catch(console.error);
