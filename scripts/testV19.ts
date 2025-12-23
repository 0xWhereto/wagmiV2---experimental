import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const WTOKEN = "0x998E56B74e0c0D94c4315aD2EfC79a99868c67A3";
const LEVERAGE_AMM = "0x897074004705Ca3C578e403090F1FF397A7807Bb";
const V3_VAULT = "0x64B933Ce0536f5508cf9Ccec9628E969434dc8E1";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test 0IL v19 ===\n");
  
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
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function getLayerCount() view returns (uint256)",
    "function getLayer(uint256) view returns (tuple(int24,int24,uint256,uint256,uint128))"
  ], signer);

  // Check layers
  const layerCount = await v3Vault.getLayerCount();
  console.log("V3LPVault layers:", layerCount.toString());
  for (let i = 0; i < layerCount; i++) {
    const layer = await v3Vault.getLayer(i);
    console.log(`  Layer ${i}: tickLower=${layer[0]}, tickUpper=${layer[1]}, tokenId=${layer[2].toString()}`);
  }

  // Check initial state
  const swethBal = await sweth.balanceOf(signer.address);
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("\nInitial sWETH:", ethers.utils.formatEther(swethBal));
  console.log("Initial wETH:", ethers.utils.formatEther(wTokenBal));
  
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
