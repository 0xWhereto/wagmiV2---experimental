import { ethers } from "hardhat";

const sUSDC = "0xA1b52eBc6e37d057e4Df26b72Ed89B05d60e9bD4";
const DEPLOYER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== Check Sonic Balance ===");
  
  const token = await ethers.getContractAt("IERC20", sUSDC);
  const balance = await token.balanceOf(DEPLOYER);
  console.log("sUSDC balance:", ethers.utils.formatUnits(balance, 6));
}

main().catch(console.error);
