import { ethers } from "hardhat";

const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const SUSDC = "0x5E501C482952c1F2D58a4294F9A97759968c5125"; // Need actual sUSDC

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Rescue More MIM ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const stakingVault = (await ethers.getContractFactory("MIMStakingVault")).attach(STAKING_VAULT);
  
  console.log("Current state:");
  console.log("  My MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("  My sMIM:", ethers.utils.formatEther(await stakingVault.balanceOf(signer.address)));
  console.log("  My sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  
  const cash = await stakingVault.getCash();
  const borrows = await stakingVault.totalBorrows();
  console.log("\n  StakingVault cash:", ethers.utils.formatEther(cash));
  console.log("  StakingVault borrows:", ethers.utils.formatEther(borrows));
  
  // The ~26 MIM borrowed is locked by the broken LeverageAMM
  // We need to write it off or somehow get it back
  
  // Option 1: Deposit more MIM to unlock sMIM proportionally
  // Option 2: As owner, adjust the borrow balance
  
  // Check if we have a function to write off bad debt
  console.log("\n  Checking for owner functions...");
  console.log("  Owner:", await stakingVault.owner());
  console.log("  Am I owner:", (await stakingVault.owner()).toLowerCase() === signer.address.toLowerCase());
  
  // Let's deposit our remaining MIM to maximize what we can withdraw
  const myMIM = await mim.balanceOf(signer.address);
  if (myMIM.gt(ethers.utils.parseEther("1"))) {
    console.log("\nDepositing remaining MIM...");
    await (await mim.approve(STAKING_VAULT, myMIM)).wait();
    
    // Keep 1 MIM for gas
    const toDeposit = myMIM.sub(ethers.utils.parseEther("1"));
    await (await stakingVault.deposit(toDeposit, { gasLimit: 500000 })).wait();
    console.log("✓ Deposited", ethers.utils.formatEther(toDeposit), "MIM");
  }
  
  // Now withdraw max
  const newCash = await stakingVault.getCash();
  const totalSupply = await stakingVault.totalSupply();
  const totalAssets = await stakingVault.totalAssets();
  const myShares = await stakingVault.balanceOf(signer.address);
  
  let maxShares = newCash.mul(totalSupply).div(totalAssets).mul(95).div(100);
  maxShares = maxShares.gt(myShares) ? myShares : maxShares;
  
  console.log("\nNew cash:", ethers.utils.formatEther(newCash));
  console.log("Can withdraw:", ethers.utils.formatEther(maxShares), "sMIM");
  
  if (maxShares.gt(0)) {
    const mimBefore = await mim.balanceOf(signer.address);
    await (await stakingVault.withdraw(maxShares, { gasLimit: 500000 })).wait();
    const mimAfter = await mim.balanceOf(signer.address);
    console.log("✓ Withdrew sMIM, got", ethers.utils.formatEther(mimAfter.sub(mimBefore)), "MIM");
  }
  
  console.log("\n=== Final State ===");
  console.log("My MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("My sMIM (locked):", ethers.utils.formatEther(await stakingVault.balanceOf(signer.address)));
  console.log("My sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  
  console.log("\n⚠️  The remaining sMIM is locked by", ethers.utils.formatEther(await stakingVault.totalBorrows()), "MIM debt from broken LeverageAMM");
  console.log("   To fully rescue: write off this bad debt in the new deployment");
}
main().catch(console.error);
