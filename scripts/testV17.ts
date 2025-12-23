import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WTOKEN = "0xb268a59ED33e968AB9a4eE28173644dd55B0c6BF";
const LEVERAGE_AMM = "0x9cD4a897f49590d3E524d1abB828cB6673d54B8D";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test 0IL v17 ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function deposit(uint256) external",
    "function withdraw(uint256) external",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], signer);
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function wToken() view returns (address)"
  ], signer);

  // Check initial state
  const swethBal = await sweth.balanceOf(signer.address);
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("Initial sWETH:", ethers.utils.formatEther(swethBal));
  console.log("Initial wETH:", ethers.utils.formatEther(wTokenBal));
  console.log("LeverageAMM wToken:", await leverageAMM.wToken());
  
  // Deposit test
  const depositAmount = ethers.utils.parseEther("0.0005");
  console.log("\n--- Deposit Test ---");
  console.log("Depositing:", ethers.utils.formatEther(depositAmount), "sWETH");
  
  // Approve
  const allowance = await sweth.allowance(signer.address, WTOKEN);
  if (allowance.lt(depositAmount)) {
    console.log("Approving...");
    await (await sweth.approve(WTOKEN, ethers.constants.MaxUint256)).wait();
  }
  
  // Deposit
  try {
    const tx = await wToken.deposit(depositAmount, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("Deposit TX:", receipt.transactionHash);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (err: any) {
    console.log("Deposit FAILED:", err.reason || err.message);
    return;
  }
  
  // Check state after deposit
  const wTokenBalAfter = await wToken.balanceOf(signer.address);
  console.log("wETH after deposit:", ethers.utils.formatEther(wTokenBalAfter));
  console.log("Total debt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("Total underlying:", ethers.utils.formatEther(await leverageAMM.totalUnderlying()));
  
  // Withdraw test
  console.log("\n--- Withdraw Test ---");
  const withdrawShares = wTokenBalAfter;
  console.log("Withdrawing:", ethers.utils.formatEther(withdrawShares), "wETH");
  
  try {
    const tx = await wToken.withdraw(withdrawShares, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("Withdraw TX:", receipt.transactionHash);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (err: any) {
    console.log("Withdraw FAILED:", err.reason || err.message);
    return;
  }
  
  // Final state
  const swethFinal = await sweth.balanceOf(signer.address);
  const wTokenFinal = await wToken.balanceOf(signer.address);
  console.log("\nFinal sWETH:", ethers.utils.formatEther(swethFinal));
  console.log("Final wETH:", ethers.utils.formatEther(wTokenFinal));
  console.log("sWETH change:", ethers.utils.formatEther(swethFinal.sub(swethBal)));
  
  console.log("\n=== Test Complete ===");
}
main().catch(console.error);
