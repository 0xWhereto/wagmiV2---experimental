import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const gettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenInfo(uint256 _tokenIndex) view returns (tuple(uint256 tokenIndex, tuple(address tokenAddress, string tokenSymbol, uint8 tokenDecimals, uint32[] chainList) syntheticTokenInfo, tuple(uint32 eid, tuple(address remoteAddress, int8 decimalsDelta, uint256 totalBalance, uint256 minBridgeAmt) remoteTokenInfo)[] remoteTokens))",
  ];

  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);

  try {
    const count = await getters.getSyntheticTokenCount();
    console.log(`Synthetic token count: ${count.toString()}`);

    for (let i = 1; i <= count.toNumber(); i++) {
      console.log(`\nFetching token ${i}...`);
      const info = await getters.getSyntheticTokenInfo(i);
      console.log(`  Address: ${info.syntheticTokenInfo.tokenAddress}`);
      console.log(`  Symbol: ${info.syntheticTokenInfo.tokenSymbol}`);
      console.log(`  Decimals: ${info.syntheticTokenInfo.tokenDecimals}`);
    }
  } catch (e: any) {
    console.log("Error:", e.reason || e.message);
  }
}

main().catch(console.error);
