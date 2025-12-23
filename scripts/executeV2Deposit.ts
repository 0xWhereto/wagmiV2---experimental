import { ethers } from "hardhat";

const WTOKEN = "0x65fc75EAe642fd08d11A1A94B9FD3820fEefF11b";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const STAKING_VAULT = "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968";
const LEVERAGE_AMM = "0x4A5Cb23ad31A81516EcA6f1A4F0C001428335855";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Execute V2 Deposit ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  const stakingVault = (await ethers.getContractFactory("MIMStakingVaultV2")).attach(STAKING_VAULT);
  
  console.log("Before:");
  console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("  wETH:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  console.log("  StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  
  const depositAmount = ethers.utils.parseEther("0.0001");
  
  await (await sweth.approve(WTOKEN, depositAmount)).wait();
  console.log("\nDepositing", ethers.utils.formatEther(depositAmount), "sWETH...");
  
  const tx = await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 });
  const receipt = await tx.wait();
  console.log("✓ Deposit tx:", receipt.transactionHash);
  console.log("  Gas used:", receipt.gasUsed.toString());
  
  console.log("\nAfter:");
  console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("  wETH:", ethers.utils.formatEther(await wToken.balanceOf(signer.address)));
  console.log("  StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  
  // Now test withdrawal
  console.log("\n=== Testing Withdrawal ===");
  const wethBal = await wToken.balanceOf(signer.address);
  const swethBefore = await sweth.balanceOf(signer.address);
  
  console.log("Withdrawing", ethers.utils.formatEther(wethBal), "wETH...");
  
  try {
    const tx2 = await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 });
    const receipt2 = await tx2.wait();
    console.log("✓ Withdraw tx:", receipt2.transactionHash);
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("  sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    console.log("\n✅ V2 DEPOSIT AND WITHDRAW BOTH WORK!");
  } catch (e: any) {
    console.log("✗ Withdraw failed:", e.reason || e.message?.slice(0, 200));
    if (e.data) {
      console.log("  Error data:", e.data.slice(0, 20));
    }
  }
}
main().catch(console.error);
