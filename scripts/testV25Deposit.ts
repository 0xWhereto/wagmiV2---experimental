import { ethers } from "hardhat";

// From testLevAMMTester deployment
const V3_VAULT = "0x63d6136e4Eb939decc5ABff6273428C5d801a894";
const LEVERAGE_AMM = "0x1254e4e88eD6F13C87A9E15e91Ec9C331881c0aB";
const WTOKEN = "0xfefb6E85776Eac5737E7e1F5D89483dc41FD2F73";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test V25 Deposit ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const WToken = await ethers.getContractFactory("WToken");
  const wToken = WToken.attach(WTOKEN);
  
  console.log("sWETH balance:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  
  // Approve
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  
  // Try deposit
  console.log("\nDepositing 0.0003 sWETH...");
  try {
    const tx = await wToken.deposit(ethers.utils.parseEther("0.0003"), 0, { gasLimit: 2000000 });
    await tx.wait();
    console.log("SUCCESS!");
    console.log("wToken balance:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message?.slice(0, 200));
  }
}
main().catch(console.error);
