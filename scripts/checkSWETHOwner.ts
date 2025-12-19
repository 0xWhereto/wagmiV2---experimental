import { ethers } from "hardhat";

async function main() {
  const sWETH = await ethers.getContractAt("SyntheticToken", "0x5E501C482952c1F2D58a4294F9A97759968c5125");
  const owner = await sWETH.owner();
  const hub = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";
  
  console.log("sWETH owner:", owner);
  console.log("Hub address:", hub);
  console.log("Match:", owner.toLowerCase() === hub.toLowerCase() ? "✓ YES" : "✗ NO");
  
  if (owner.toLowerCase() !== hub.toLowerCase()) {
    console.log("\n⚠️ Hub is NOT the owner of sWETH!");
    console.log("The Hub cannot mint sWETH tokens.");
    console.log("You need to transfer ownership of sWETH to the Hub.");
  }
}

main();

