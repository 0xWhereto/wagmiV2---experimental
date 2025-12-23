import { ethers } from "hardhat";

const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Bypass LeverageAMM and Rescue Tokens ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256)",
    "function approve(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const stakingVault = (await ethers.getContractFactory("MIMStakingVault")).attach(STAKING_VAULT);
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  
  console.log("1. Current state:");
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("   V3 assets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  console.log("   LeverageAMM debt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("   StakingVault borrows:", ethers.utils.formatEther(await stakingVault.totalBorrows()));
  
  // Step 1: As owner of V3LPVault, drain all liquidity
  console.log("\n2. Draining V3LPVault as owner...");
  const swethBefore = await sweth.balanceOf(signer.address);
  const mimBefore = await mim.balanceOf(signer.address);
  
  try {
    const tx = await v3Vault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 }); // 100%
    await tx.wait();
    console.log("   ✓ Liquidity removed!");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    const mimAfter = await mim.balanceOf(signer.address);
    console.log("   sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    console.log("   MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
  } catch (err: any) {
    console.log("   ✗ Failed:", err.reason || err.message?.slice(0, 200));
    
    // Try rescueTokens if exists
    console.log("\n   Trying rescueTokens...");
    try {
      await v3Vault.rescueTokens(MIM, await mim.balanceOf(V3_VAULT));
      await v3Vault.rescueTokens(SWETH, await sweth.balanceOf(V3_VAULT));
      console.log("   ✓ Rescued via rescueTokens!");
    } catch (e2: any) {
      console.log("   ✗ rescueTokens also failed:", e2.message?.slice(0, 100));
    }
  }
  
  // Step 2: Manually repay the debt to StakingVault
  console.log("\n3. Manually repaying StakingVault debt...");
  const borrowBalance = await stakingVault.borrowBalanceOf(LEVERAGE_AMM);
  console.log("   LeverageAMM owes:", ethers.utils.formatEther(borrowBalance));
  
  // As owner of StakingVault, we can reduce borrows directly or just deposit MIM
  // Actually, let's just deposit lots of MIM to increase cash so we can withdraw sMIM
  
  const myMIM = await mim.balanceOf(signer.address);
  console.log("   My MIM:", ethers.utils.formatEther(myMIM));
  
  // Try to deposit more MIM to increase liquidity
  if (myMIM.gt(0)) {
    console.log("\n4. Depositing MIM to increase vault cash...");
    await (await mim.approve(STAKING_VAULT, myMIM)).wait();
    
    const tx = await stakingVault.deposit(myMIM.div(2), { gasLimit: 500000 });
    await tx.wait();
    console.log("   ✓ Deposited", ethers.utils.formatEther(myMIM.div(2)), "MIM");
    
    console.log("   New vault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  }
  
  // Step 3: Withdraw sMIM
  console.log("\n5. Withdrawing sMIM...");
  const myShares = await stakingVault.balanceOf(signer.address);
  console.log("   My sMIM:", ethers.utils.formatEther(myShares));
  
  // Withdraw in chunks
  const cash = await stakingVault.getCash();
  const totalSupply = await stakingVault.totalSupply();
  const totalAssets = await stakingVault.totalAssets();
  
  let maxShares = cash.mul(totalSupply).div(totalAssets).mul(95).div(100); // 95% of max
  maxShares = maxShares.gt(myShares) ? myShares : maxShares;
  
  if (maxShares.gt(0)) {
    try {
      const tx = await stakingVault.withdraw(maxShares, { gasLimit: 500000 });
      await tx.wait();
      console.log("   ✓ Withdrew", ethers.utils.formatEther(maxShares), "sMIM");
    } catch (e: any) {
      console.log("   ✗ Failed:", e.reason || "transaction failed");
    }
  }
  
  // Final state
  console.log("\n=== Final State ===");
  console.log("sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  console.log("sMIM:", ethers.utils.formatEther(await stakingVault.balanceOf(signer.address)));
  console.log("StakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  console.log("StakingVault borrows:", ethers.utils.formatEther(await stakingVault.totalBorrows()));
}
main().catch(console.error);
