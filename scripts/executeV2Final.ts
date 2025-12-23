import { ethers } from "hardhat";

const WTOKEN = "0xbEd139f379B85B68f44EEd84d519d6608C090361";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Execute V2 Final ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const depositAmount = ethers.utils.parseEther("0.0001");
  
  console.log("sWETH before:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("wETH before:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  
  await (await sweth.approve(WTOKEN, depositAmount)).wait();
  
  console.log("\nDepositing with 3M gas...");
  const tx = await wToken.deposit(depositAmount, 0, { gasLimit: 3000000 });
  console.log("Tx hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  console.log("\nsWETH after:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("wETH after:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  
  if (receipt.status === 1) {
    console.log("\n=== Now testing withdrawal ===");
    const wethBal = await wToken.balanceOf(signer.address);
    const swethBefore = await sweth.balanceOf(signer.address);
    
    const tx2 = await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 });
    const receipt2 = await tx2.wait();
    
    console.log("Withdraw status:", receipt2.status === 1 ? "SUCCESS" : "FAILED");
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
  }
}
main().catch(console.error);
