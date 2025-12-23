import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WTOKEN = "0x7274fF5B9Ac5A673a89610cc58B54d173FfEb8aB";
const LEVERAGE_AMM = "0xB9897871Fb8cBE4767F660a5AE237e37b8b00D2a";
const V3_VAULT = "0x79e781aF3B8994380a3Ec7Cb8eDD3e70d6F7b2E4";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test 0IL v20 (Clean State) ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function deposit(uint256,uint256) external returns (uint256)",
    "function withdraw(uint256,uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)"
  ], signer);
  
  // Initial state
  const swethBal = await sweth.balanceOf(signer.address);
  console.log("Initial sWETH:", ethers.utils.formatEther(swethBal));
  
  // Approve
  console.log("Approving...");
  await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  
  // Deposit
  const depositAmount = ethers.utils.parseEther("0.0005");
  console.log("\n--- Deposit ---");
  console.log("Depositing:", ethers.utils.formatEther(depositAmount), "sWETH");
  
  try {
    const tx = await wToken.deposit(depositAmount, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("Deposit TX:", receipt.transactionHash);
    console.log("SUCCESS!");
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
    return;
  }
  
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("wETH balance:", ethers.utils.formatEther(wTokenBal));
  console.log("Total debt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("Total underlying:", ethers.utils.formatEther(await leverageAMM.totalUnderlying()));
  
  // Withdraw
  console.log("\n--- Withdraw ---");
  console.log("Withdrawing:", ethers.utils.formatEther(wTokenBal), "wETH");
  
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("Withdraw TX:", receipt.transactionHash);
    console.log("SUCCESS!");
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
    return;
  }
  
  const swethFinal = await sweth.balanceOf(signer.address);
  console.log("\nFinal sWETH:", ethers.utils.formatEther(swethFinal));
  console.log("sWETH change:", ethers.utils.formatEther(swethFinal.sub(swethBal)));
  
  console.log("\n=== Test Complete ===");
}
main().catch(console.error);
