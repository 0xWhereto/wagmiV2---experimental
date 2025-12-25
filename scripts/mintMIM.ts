/**
 * Mint MIM using sUSDC
 */

import { ethers } from "hardhat";

const CONTRACTS = {
  mim: "0x5Ba71A159bE146aD4ef7f7b7f40d274d8f4E0440",
  sUSDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
];

const MIM_ABI = [
  "function mintWithUSDC(uint256 amount) external",
  "function mimUsdcPool() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);
  
  const sUSDC = new ethers.Contract(CONTRACTS.sUSDC, ERC20_ABI, signer);
  const mim = new ethers.Contract(CONTRACTS.mim, MIM_ABI, signer);
  
  const usdcBalance = await sUSDC.balanceOf(signer.address);
  const mimBalance = await mim.balanceOf(signer.address);
  
  console.log("sUSDC balance:", ethers.utils.formatUnits(usdcBalance, 6));
  console.log("MIM balance:", ethers.utils.formatEther(mimBalance));
  
  // Check pool is set
  const pool = await mim.mimUsdcPool();
  console.log("MIM/sUSDC Pool:", pool);
  
  if (usdcBalance.gt(0)) {
    // Use half of balance for minting
    const amountToMint = usdcBalance.div(2);
    console.log("\nMinting", ethers.utils.formatUnits(amountToMint, 6), "MIM...");
    
    // Approve sUSDC
    await (await sUSDC.approve(CONTRACTS.mim, amountToMint)).wait();
    console.log("Approved sUSDC");
    
    // Mint MIM
    try {
      const tx = await mim.mintWithUSDC(amountToMint, { gasLimit: 800000 });
      const receipt = await tx.wait();
      console.log("MIM minted! Tx:", tx.hash);
      console.log("Gas used:", receipt.gasUsed.toString());
      
      const newMimBalance = await mim.balanceOf(signer.address);
      console.log("New MIM balance:", ethers.utils.formatEther(newMimBalance));
    } catch (e: any) {
      console.log("Error minting:", e.message);
    }
  } else {
    console.log("\nNo sUSDC to mint MIM with");
    console.log("You need to bridge USDC from another chain first");
  }
}

main().catch(console.error);


