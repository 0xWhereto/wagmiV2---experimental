import { ethers } from "hardhat";

const ADDRESSES = {
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
  leverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  v3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  stakingVault: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing with:", signer.address);
  
  const stakingVault = new ethers.Contract(ADDRESSES.stakingVault, [
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function maxUtilization() view returns (uint256)",
  ], signer);
  
  const cash = await stakingVault.getCash();
  const borrows = await stakingVault.totalBorrows();
  
  console.log("\nStakingVault:");
  console.log("  Cash:", ethers.utils.formatEther(cash), "MIM");
  console.log("  Borrows:", ethers.utils.formatEther(borrows), "MIM");
  console.log("  Available for borrow (90%):", parseFloat(ethers.utils.formatEther(cash)) * 0.9, "MIM");
  
  // Calculate max sWETH deposit based on available MIM
  // For 2x leverage, we need ~3000 MIM per sWETH
  const availableMIM = parseFloat(ethers.utils.formatEther(cash)) * 0.9;
  const maxSWETH = availableMIM / 3000;
  console.log("  Max sWETH deposit:", maxSWETH);
  
  // Test very small amount
  const testAmount = ethers.utils.parseEther("0.0001"); // 0.0001 sWETH = ~0.3 MIM borrow
  
  const wETH = new ethers.Contract(ADDRESSES.wETH, [
    "function convertToShares(uint256) view returns (uint256)",
    "function deposit(uint256,uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
  ], signer);
  
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
  ], signer);
  
  const balance = await sWETH.balanceOf(signer.address);
  console.log("\nUser sWETH balance:", ethers.utils.formatEther(balance));
  
  if (balance.lt(testAmount)) {
    console.log("Not enough sWETH for test");
    return;
  }
  
  // Approve
  await (await sWETH.approve(ADDRESSES.wETH, ethers.constants.MaxUint256)).wait();
  console.log("Approved");
  
  // Test conversion
  const shares = await wETH.convertToShares(testAmount);
  console.log("\nConversion: 0.0001 sWETH ->", ethers.utils.formatEther(shares), "wETH");
  
  // Try deposit
  console.log("\nDepositing 0.0001 sWETH...");
  try {
    const balBefore = await wETH.balanceOf(signer.address);
    const tx = await wETH.deposit(testAmount, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    const balAfter = await wETH.balanceOf(signer.address);
    
    console.log("Success! Tx:", receipt.transactionHash);
    console.log("wETH received:", ethers.utils.formatEther(balAfter.sub(balBefore)));
    
    console.log("\nAfter deposit:");
    console.log("  totalSupply:", ethers.utils.formatEther(await wETH.totalSupply()));
    console.log("  pricePerShare:", ethers.utils.formatEther(await wETH.pricePerShare()));
    
  } catch (e: any) {
    console.log("Failed:", e.reason || e.message?.slice(0, 200));
  }
}

main().catch(console.error);

