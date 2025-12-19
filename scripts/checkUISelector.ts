import { ethers } from "hardhat";

async function main() {
  // The UI ABI signature (with named components in tuple)
  const uiSig = "function bridgeTokens(address _recipient, (address tokenAddress, uint256 tokenAmount)[] _assets, uint32 _dstEid, bytes _options)";
  
  // The minimal signature (without names)
  const minimalSig = "function bridgeTokens(address,tuple(address,uint256)[],uint32,bytes)";
  
  // What viem might compute
  const viemStyleSig = "function bridgeTokens(address,(address,uint256)[],uint32,bytes)";
  
  console.log("Checking selectors:\n");
  
  for (const sig of [uiSig, minimalSig, viemStyleSig]) {
    try {
      const iface = new ethers.utils.Interface([sig]);
      const sel = iface.getSighash("bridgeTokens");
      console.log(`${sel}: ${sig.substring(0, 80)}...`);
    } catch (e: any) {
      console.log(`Error: ${sig.substring(0, 50)}... - ${e.message?.substring(0, 50)}`);
    }
  }
  
  console.log("\nHub has selector: 0xd441f6c8");
}

main().catch(console.error);
