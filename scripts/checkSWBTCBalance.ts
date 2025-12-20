import { ethers } from "hardhat";

const SBTC = "0x2F0324268031E6413280F3B5ddBc4A97639A284a";
const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";

async function main() {
  console.log("=== CHECKING sWBTC BALANCE ===\n");
  
  const sbtc = await ethers.getContractAt("IERC20", SBTC);
  const balance = await sbtc.balanceOf(USER);
  console.log(`sWBTC balance: ${ethers.utils.formatUnits(balance, 8)}`);
  
  if (balance.gt(0)) {
    console.log("\n✅ SUCCESS! WBTC bridge is working!");
  } else {
    console.log("\n❌ No sWBTC yet - message might still be in transit");
  }
}

main().catch(console.error);
