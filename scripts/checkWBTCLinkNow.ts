import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== CHECKING WBTC LINK ON HUB ===\n");
  
  // Use the getters contract
  const gettersAbi = [
    "function getRemoteTokenInfo(address hub, uint32 srcEid, address remoteToken) external view returns (tuple(address syntheticTokenAddress, uint8 decimals, bool isLinked))",
  ];
  
  const getters = new ethers.Contract(
    "0x5fCCDE31a1F62e7b1a4f64bB7bdBa5cE70bB1C59", // Getters contract
    gettersAbi,
    new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com")
  );
  
  console.log("Checking if WBTC is linked from Arbitrum...");
  try {
    const info = await getters.getRemoteTokenInfo(HUB, ARB_EID, WBTC);
    console.log(`  Synthetic: ${info.syntheticTokenAddress}`);
    console.log(`  Decimals: ${info.decimals}`);
    console.log(`  Is Linked: ${info.isLinked}`);
    
    if (info.isLinked) {
      console.log("\n✅ WBTC is properly linked on Hub!");
      console.log(`Bridge to sWBTC at: ${info.syntheticTokenAddress}`);
    } else {
      console.log("\n❌ WBTC is NOT linked on Hub");
    }
  } catch (e: any) {
    console.log(`Error checking link: ${e.message?.slice(0, 200)}`);
  }
  
  // Also check all synthetic tokens on hub
  const hubAbi = [
    "function syntheticTokens(uint256) view returns (address)",
    "function syntheticTokensLength() view returns (uint256)",
  ];
  
  const hub = new ethers.Contract(
    HUB, 
    hubAbi, 
    new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com")
  );
  
  console.log("\n=== ALL SYNTHETIC TOKENS ON HUB ===");
  try {
    const len = await hub.syntheticTokensLength();
    console.log(`Total synthetic tokens: ${len}`);
    
    for (let i = 0; i < len; i++) {
      const addr = await hub.syntheticTokens(i);
      // Get name
      const tokenContract = new ethers.Contract(
        addr,
        ["function symbol() view returns (string)"],
        new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com")
      );
      const symbol = await tokenContract.symbol();
      console.log(`  ${i}: ${symbol} - ${addr}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
}

main().catch(console.error);
