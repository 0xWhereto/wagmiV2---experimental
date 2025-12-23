import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Withdraw Max Available MIM ===\n");
  
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  const vault = MIMStakingVault.attach(STAKING_VAULT);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  // Current state
  const cash = await vault.getCash();
  const totalSupply = await vault.totalSupply();
  const totalAssets = await vault.totalAssets();
  const totalBorrows = await vault.totalBorrows();
  const myShares = await vault.balanceOf(signer.address);
  
  console.log("Current State:");
  console.log("  Cash available:", ethers.utils.formatEther(cash));
  console.log("  Total borrows:", ethers.utils.formatEther(totalBorrows));
  console.log("  My sMIM shares:", ethers.utils.formatEther(myShares));
  console.log("  Total supply:", ethers.utils.formatEther(totalSupply));
  
  // Calculate shares that can be withdrawn with current cash
  // shares = cash * totalSupply / totalAssets
  if (cash.gt(0) && totalAssets.gt(0)) {
    let maxSharesForCash = cash.mul(totalSupply).div(totalAssets);
    // Take 99% to avoid rounding issues
    maxSharesForCash = maxSharesForCash.mul(99).div(100);
    
    const toWithdraw = maxSharesForCash.gt(myShares) ? myShares : maxSharesForCash;
    console.log("\n  Max withdrawable shares:", ethers.utils.formatEther(toWithdraw));
    
    if (toWithdraw.gt(0)) {
      console.log("\nWithdrawing", ethers.utils.formatEther(toWithdraw), "sMIM...");
      
      const mimBefore = await mim.balanceOf(signer.address);
      
      try {
        const tx = await vault.withdraw(toWithdraw, { gasLimit: 500000 });
        await tx.wait();
        console.log("✓ Success!");
        
        const mimAfter = await mim.balanceOf(signer.address);
        console.log("MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
        console.log("Total MIM now:", ethers.utils.formatEther(mimAfter));
        
        const remainingShares = await vault.balanceOf(signer.address);
        console.log("Remaining sMIM:", ethers.utils.formatEther(remainingShares));
        
        // Check new state
        const newCash = await vault.getCash();
        const newBorrows = await vault.totalBorrows();
        console.log("\nNew cash:", ethers.utils.formatEther(newCash));
        console.log("Borrows (locked):", ethers.utils.formatEther(newBorrows));
      } catch (err: any) {
        console.log("✗ Failed:", err.reason || err.message?.slice(0, 200));
      }
    }
  }
  
  // Summary of remaining situation
  console.log("\n=== Remaining Situation ===");
  const remainingBorrows = await vault.totalBorrows();
  const remainingShares = await vault.balanceOf(signer.address);
  console.log("Remaining sMIM shares:", ethers.utils.formatEther(remainingShares));
  console.log("Remaining borrows (LeverageAMM):", ethers.utils.formatEther(remainingBorrows));
  console.log("\nTo rescue the rest, we need to repay the LeverageAMM debt first.");
}
main().catch(console.error);
