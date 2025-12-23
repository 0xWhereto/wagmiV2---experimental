import { ethers } from "hardhat";

const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test Withdraw Now ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("wToken balance:", ethers.utils.formatEther(wTokenBal));
  
  const swethBefore = await sweth.balanceOf(signer.address);
  console.log("sWETH before:", ethers.utils.formatEther(swethBefore));
  
  if (wTokenBal.eq(0)) {
    console.log("No wToken to withdraw!");
    return;
  }
  
  // Withdraw all
  console.log("\nWithdrawing all wToken...");
  
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
    const receipt = await tx.wait();
    console.log("✓ Withdraw SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH after:", ethers.utils.formatEther(swethAfter));
    console.log("sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    
    const newWTokenBal = await wToken.balanceOf(signer.address);
    console.log("wToken balance:", ethers.utils.formatEther(newWTokenBal));
    
  } catch (err: any) {
    console.log("✗ Withdraw FAILED:", err.reason || err.message?.slice(0, 300));
    
    // Decode error
    if (err.data) {
      console.log("Error data:", err.data);
    }
  }
}
main().catch(console.error);
