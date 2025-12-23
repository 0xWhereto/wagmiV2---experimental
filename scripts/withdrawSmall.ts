import { ethers } from "hardhat";

const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Withdraw MIM in Small Amounts ===\n");
  
  const MIMStakingVault = await ethers.getContractFactory("MIMStakingVault");
  const vault = MIMStakingVault.attach(STAKING_VAULT);
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  
  const mimBefore = await mim.balanceOf(signer.address);
  console.log("MIM before:", ethers.utils.formatEther(mimBefore));
  
  // Withdraw 5 shares at a time
  const withdrawAmount = ethers.utils.parseEther("5");
  
  let myShares = await vault.balanceOf(signer.address);
  console.log("My sMIM:", ethers.utils.formatEther(myShares));
  
  let withdrawn = 0;
  while (myShares.gt(0)) {
    const toWithdraw = myShares.lt(withdrawAmount) ? myShares : withdrawAmount;
    console.log(`\nWithdrawing ${ethers.utils.formatEther(toWithdraw)} sMIM...`);
    
    try {
      const tx = await vault.withdraw(toWithdraw, { gasLimit: 500000 });
      await tx.wait();
      console.log("  ✓ Success!");
      withdrawn++;
      
      myShares = await vault.balanceOf(signer.address);
      console.log("  Remaining sMIM:", ethers.utils.formatEther(myShares));
    } catch (err: any) {
      console.log("  ✗ Failed:", err.reason || "transaction failed");
      break;
    }
    
    // Safety limit
    if (withdrawn > 10) {
      console.log("\nSafety limit reached, stopping");
      break;
    }
  }
  
  const mimAfter = await mim.balanceOf(signer.address);
  console.log("\n=== Summary ===");
  console.log("MIM before:", ethers.utils.formatEther(mimBefore));
  console.log("MIM after:", ethers.utils.formatEther(mimAfter));
  console.log("MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
  console.log("Remaining sMIM:", ethers.utils.formatEther(await vault.balanceOf(signer.address)));
}
main().catch(console.error);
