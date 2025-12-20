import { ethers } from "hardhat";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
  
  const balance = await usdc.balanceOf(USER);
  console.log(`User USDC balance on Arbitrum: ${ethers.utils.formatUnits(balance, 6)} USDC`);
}

main().catch(console.error);
