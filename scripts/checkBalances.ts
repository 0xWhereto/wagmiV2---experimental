import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Check User Balances ===\n");
  console.log("User:", signer.address);
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  console.log("sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("\nNeed 0.0005 sWETH for deposit");
}
main().catch(console.error);
