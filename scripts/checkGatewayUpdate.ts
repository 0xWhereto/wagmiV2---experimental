import { ethers } from "hardhat";

const GATEWAY_ARB = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const code = await provider.getCode(GATEWAY_ARB);
  
  console.log("Looking for functions to update token synthetic address...\n");
  
  const funcs = [
    { name: "updateTokenSynthetic", sig: "function updateTokenSynthetic(address,address)" },
    { name: "setTokenSyntheticAddress", sig: "function setTokenSyntheticAddress(address,address)" },
    { name: "updateAvailableToken", sig: "function updateAvailableToken(uint256,address)" },
    { name: "relinkToken", sig: "function relinkToken(address,address)" },
    { name: "linkTokenToHub", sig: "function linkTokenToHub(tuple(bool,address,uint8,address,uint256)[],bytes)" },
    { name: "removeToken", sig: "function removeToken(address)" },
    { name: "deleteToken", sig: "function deleteToken(address)" },
  ];
  
  for (const f of funcs) {
    try {
      const iface = new ethers.utils.Interface([f.sig]);
      const sel = iface.getSighash(f.name);
      const exists = code.toLowerCase().includes(sel.substring(2).toLowerCase());
      console.log(`${exists ? "✅" : "❌"} ${f.name}: ${sel}`);
    } catch (e) {
      console.log(`Error: ${f.name}`);
    }
  }

  // Check linkTokenToHub specifically
  console.log("\n\nChecking linkTokenToHub selector...");
  const linkSig = "function linkTokenToHub((bool onPause, address tokenAddress, uint8 syntheticTokenDecimals, address syntheticTokenAddress, uint256 minBridgeAmt)[] _tokensConfig, bytes _options)";
  try {
    const iface = new ethers.utils.Interface([linkSig]);
    const sel = iface.getSighash("linkTokenToHub");
    console.log(`linkTokenToHub selector: ${sel}`);
    console.log(`In bytecode: ${code.toLowerCase().includes(sel.substring(2).toLowerCase())}`);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

main().catch(console.error);
