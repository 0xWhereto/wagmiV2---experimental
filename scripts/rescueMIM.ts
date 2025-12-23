import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Rescue MIM from Staking Vault ===\n");
  
  const vault = new ethers.Contract(STAKING_VAULT, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function totalAssets() view returns (uint256)",
    "function totalBorrows() view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function withdraw(uint256) returns (uint256)",
    "function convertToAssets(uint256) view returns (uint256)",
    "function owner() view returns (address)",
  ], signer);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  // Check state
  const myShares = await vault.balanceOf(signer.address);
  const totalSupply = await vault.totalSupply();
  const cash = await vault.getCash();
  const totalBorrows = await vault.totalBorrows();
  const totalAssets = await vault.totalAssets();
  
  console.log("1. Current State:");
  console.log("   My sMIM shares:", ethers.utils.formatEther(myShares));
  console.log("   Total sMIM supply:", ethers.utils.formatEther(totalSupply));
  console.log("   Cash (available MIM):", ethers.utils.formatEther(cash));
  console.log("   Total Borrows:", ethers.utils.formatEther(totalBorrows));
  console.log("   Total Assets:", ethers.utils.formatEther(totalAssets));
  
  const myAssets = await vault.convertToAssets(myShares);
  console.log("\n   My shares worth:", ethers.utils.formatEther(myAssets), "MIM");
  console.log("   Can withdraw:", ethers.utils.formatEther(cash.lt(myAssets) ? cash : myAssets), "MIM");
  
  const mimBefore = await mim.balanceOf(signer.address);
  console.log("\n   MIM balance before:", ethers.utils.formatEther(mimBefore));
  
  // Check if we're owner (for emergency functions)
  const owner = await vault.owner();
  console.log("   Vault owner:", owner);
  console.log("   Am I owner:", owner.toLowerCase() === signer.address.toLowerCase());
  
  // Try to withdraw max possible
  if (myShares.gt(0)) {
    console.log("\n2. Withdrawing all shares...");
    
    try {
      const tx = await vault.withdraw(myShares, { gasLimit: 500000 });
      const receipt = await tx.wait();
      console.log("   ✓ Withdraw succeeded! Gas:", receipt.gasUsed.toString());
      
      const mimAfter = await mim.balanceOf(signer.address);
      console.log("   MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
      console.log("   Total MIM now:", ethers.utils.formatEther(mimAfter));
    } catch (err: any) {
      console.log("   ✗ Withdraw failed:", err.reason || err.message?.slice(0, 200));
      
      // Try withdrawing just the cash amount
      if (cash.gt(0)) {
        console.log("\n3. Trying to withdraw just available cash...");
        
        // Calculate shares for cash amount
        const sharesForcash = cash.mul(totalSupply).div(totalAssets);
        console.log("   Shares for available cash:", ethers.utils.formatEther(sharesForcash));
        
        try {
          const tx = await vault.withdraw(sharesForcash, { gasLimit: 500000 });
          const receipt = await tx.wait();
          console.log("   ✓ Partial withdraw succeeded!");
          
          const mimAfter = await mim.balanceOf(signer.address);
          console.log("   MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
        } catch (e: any) {
          console.log("   ✗ Partial withdraw also failed:", e.reason || e.message?.slice(0, 150));
        }
      }
    }
  } else {
    console.log("\n   No sMIM shares to withdraw!");
  }
}
main().catch(console.error);
