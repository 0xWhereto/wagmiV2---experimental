import { ethers } from "hardhat";

const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const gettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenIndex(address _tokenAddress) view returns (uint256)",
  ];
  const getters = new ethers.Contract(GETTERS, gettersAbi, deployer);
  
  console.log("=== Existing Synthetic Tokens on Hub ===\n");
  
  // Known synthetic tokens
  const synthetics = [
    { symbol: "sWETH", address: "0x5E501C482952c1F2D58a4294F9A97759968c5125" },
    { symbol: "sUSDT", address: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa" },
    { symbol: "sUSDC", address: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B" },
    { symbol: "sBTC", address: "0x2F0324268031E6413280F3B5ddBc4A97639A284a" },
  ];
  
  const erc20Abi = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
  
  for (const token of synthetics) {
    try {
      const idx = await getters.getSyntheticTokenIndex(token.address);
      const erc20 = new ethers.Contract(token.address, erc20Abi, deployer);
      const decimals = await erc20.decimals();
      console.log(`✅ ${token.symbol} (index ${idx}): ${token.address}`);
      console.log(`   Decimals: ${decimals}`);
    } catch (e: any) {
      console.log(`❌ ${token.symbol}: ${e.message?.substring(0, 50)}`);
    }
  }
  
  // Total count
  try {
    const count = await getters.getSyntheticTokenCount();
    console.log(`\nTotal synthetic tokens: ${count}`);
  } catch (e) {
    console.log("\nCouldn't get total count");
  }
}

main().catch(console.error);
