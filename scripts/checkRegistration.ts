import { ethers } from "hardhat";

const GETTERS_ADDRESS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";

const SYNTHETIC_ADDRESSES = {
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  sUSDT: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa",
  sUSDC: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B",
  sBTC: "0x2F0324268031E6413280F3B5ddBc4A97639A284a",
};

async function main() {
  const [deployer] = await ethers.getSigners();

  const gettersAbi = [
    "function getSyntheticTokenCount() view returns (uint256)",
    "function getSyntheticTokenIndex(address _tokenAddress) view returns (uint256)",
    "function isTokenRegistered(address _tokenAddress) view returns (bool)",
  ];
  const getters = new ethers.Contract(GETTERS_ADDRESS, gettersAbi, deployer);

  console.log("Using Getters contract at", GETTERS_ADDRESS);
  console.log("\nChecking synthetic token registration...\n");

  try {
    const count = await getters.getSyntheticTokenCount();
    console.log(`Total synthetic tokens: ${count}\n`);
  } catch (e: any) {
    console.log(`Cannot get count: ${e.message?.substring(0, 80)}`);
  }

  for (const [name, addr] of Object.entries(SYNTHETIC_ADDRESSES)) {
    try {
      const isRegistered = await getters.isTokenRegistered(addr);
      const index = await getters.getSyntheticTokenIndex(addr);
      console.log(`${name} (${addr}):`);
      console.log(`  Registered: ${isRegistered}`);
      console.log(`  Index: ${index}`);
    } catch (e: any) {
      console.log(`${name}: Error - ${e.message?.substring(0, 80)}`);
    }
    console.log();
  }
}

main().catch(console.error);
