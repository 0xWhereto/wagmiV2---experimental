import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS_ADDRESS = "0x5eda8CfD3A83C168C0c7709E71E8898D7a0ab1A2";

async function main() {
  console.log("=== CHECKING HUB SYNTHETIC TOKENS ===\n");
  
  const sonicProvider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const gettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenByIndex(uint256 index) view returns (address tokenAddress, string memory tokenSymbol, uint8 tokenDecimals, uint32[] memory chainList)",
    "function getRemoteTokenInfo(address syntheticToken, uint32 eid) view returns (address remoteAddress, int8 decimalsDelta, uint256 totalBalance, uint256 minBridgeAmt)",
  ];
  
  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, sonicProvider);
  
  try {
    const count = await getters.getSyntheticTokenCount();
    console.log(`Total synthetic tokens: ${count}\n`);
    
    for (let i = 1; i <= count.toNumber(); i++) {
      const token = await getters.getSyntheticTokenByIndex(i);
      console.log(`[${i}] ${token.tokenSymbol}:`);
      console.log(`    Address: ${token.tokenAddress}`);
      console.log(`    Decimals: ${token.tokenDecimals}`);
      console.log(`    Chains: ${token.chainList.join(", ")}`);
      
      // Check if linked to Arbitrum (30110)
      if (token.chainList.includes(30110)) {
        const remoteInfo = await getters.getRemoteTokenInfo(token.tokenAddress, 30110);
        console.log(`    Arbitrum Remote: ${remoteInfo.remoteAddress}`);
      }
      console.log();
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
