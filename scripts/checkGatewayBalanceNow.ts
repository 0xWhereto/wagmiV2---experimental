import { ethers } from "hardhat";

const GATEWAY = "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
  
  const balance = await usdc.balanceOf(GATEWAY);
  console.log(`Gateway USDC balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);
}

main().catch(console.error);
