import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const ARB_EID = 30110;
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("=== CHECKING WBTC LINK ON HUB ===\n");
  
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  // Direct storage read for remoteTokenInfo mapping
  // remoteTokenInfo is mapping(uint32 => mapping(address => RemoteTokenInfo))
  // Storage slot for remoteTokenInfo is slot 9 (need to verify)
  
  // Let's try reading via Hub directly
  const hubAbi = [
    "function syntheticTokensLength() view returns (uint256)",
  ];
  
  const hub = new ethers.Contract(HUB, hubAbi, provider);
  
  try {
    const len = await hub.syntheticTokensLength();
    console.log(`Synthetic tokens length: ${len.toString()}`);
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 100)}`);
  }
  
  // Try calling the getters contract with correct checksum
  const gettersAddress = ethers.utils.getAddress("0x5fCCDE31a1F62e7b1a4f64bB7bdBa5cE70bB1C59");
  console.log(`Getters address: ${gettersAddress}`);
  
  const gettersAbi = [
    "function getRemoteTokenInfo(address hub, uint32 srcEid, address remoteToken) external view returns (tuple(address syntheticTokenAddress, uint8 decimals, bool isLinked))",
    "function getAllSyntheticTokens(address hub) external view returns (tuple(address tokenAddress, string name, string symbol, uint8 decimals)[])",
  ];
  
  const getters = new ethers.Contract(gettersAddress, gettersAbi, provider);
  
  console.log("\nChecking WBTC link from Arbitrum...");
  try {
    const info = await getters.getRemoteTokenInfo(HUB, ARB_EID, WBTC);
    console.log(`  Synthetic: ${info.syntheticTokenAddress}`);
    console.log(`  Decimals: ${info.decimals}`);
    console.log(`  Is Linked: ${info.isLinked}`);
    
    if (info.isLinked) {
      console.log("\n✅ WBTC is properly linked!");
    } else {
      console.log("\n❌ WBTC NOT linked");
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
  
  console.log("\nGetting all synthetic tokens...");
  try {
    const tokens = await getters.getAllSyntheticTokens(HUB);
    console.log(`Found ${tokens.length} synthetic tokens:`);
    for (const t of tokens) {
      console.log(`  ${t.symbol}: ${t.tokenAddress}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message?.slice(0, 200)}`);
  }
}

main().catch(console.error);
