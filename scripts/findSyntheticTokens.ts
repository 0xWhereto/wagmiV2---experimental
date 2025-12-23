import { ethers } from "hardhat";

const HUB = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
const GETTERS = "0x6860dE88abb940F3f4Ff63F0DEEc3A78b9a8141e";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ARB_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const ARB_EID = 30110;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Find Synthetic Tokens ===\n");
  
  const getters = new ethers.Contract(GETTERS, [
    "function getSyntheticTokenByRemote(address hub, uint32 eid, address token) view returns (address)"
  ], signer);
  
  console.log("1. Looking up sUSDC from Arbitrum USDC...");
  try {
    const sUSDC = await getters.getSyntheticTokenByRemote(HUB, ARB_EID, ARB_USDC);
    console.log("   sUSDC address:", sUSDC);
    
    if (sUSDC !== ethers.constants.AddressZero) {
      const token = new ethers.Contract(sUSDC, [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)"
      ], signer);
      const balance = await token.balanceOf(signer.address);
      const symbol = await token.symbol();
      console.log("   Symbol:", symbol);
      console.log("   Balance:", ethers.utils.formatUnits(balance, 6));
    }
  } catch (e: any) {
    console.log("   Error:", e.message?.slice(0, 100));
  }
  
  console.log("\n2. Looking up sWETH from Arbitrum WETH...");
  try {
    const sWETH = await getters.getSyntheticTokenByRemote(HUB, ARB_EID, ARB_WETH);
    console.log("   sWETH address:", sWETH);
    
    if (sWETH !== ethers.constants.AddressZero) {
      const token = new ethers.Contract(sWETH, [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)"
      ], signer);
      const balance = await token.balanceOf(signer.address);
      const symbol = await token.symbol();
      console.log("   Symbol:", symbol);
      console.log("   Balance:", ethers.utils.formatEther(balance));
    }
  } catch (e: any) {
    console.log("   Error:", e.message?.slice(0, 100));
  }
}
main().catch(console.error);
