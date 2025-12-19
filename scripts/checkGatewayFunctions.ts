import { ethers } from "hardhat";

const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const code = await provider.getCode(GATEWAY_ARB);
  
  console.log("=== Gateway Functions Check ===\n");
  
  const funcs = [
    "function registerToken(address,address,int8)",
    "function linkToken(address,address)",
    "function setTokenSynthetic(address,address)",
    "function updateToken(uint256,address)",
    "function addToken(address,address,int8)",
    "function setSyntheticToken(address,address)",
    "function linkRemoteToken(address,address,int8)",
    "function owner() view returns (address)",
    "function setPeer(uint32,bytes32)",
  ];
  
  for (const sig of funcs) {
    try {
      const iface = new ethers.utils.Interface([sig]);
      const name = sig.split(" ")[1].split("(")[0];
      const sel = iface.getSighash(name);
      const exists = code.toLowerCase().includes(sel.substring(2).toLowerCase());
      console.log(`${exists ? "✅" : "❌"} ${name}: ${sel}`);
    } catch (e) {
      console.log(`Error: ${sig}`);
    }
  }
}

main().catch(console.error);
