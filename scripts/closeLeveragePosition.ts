import { ethers } from "hardhat";

const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Close LeverageAMM Position ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256)"
  ], signer);
  
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  console.log("1. Current LeverageAMM State:");
  console.log("   totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("   V3 sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("   V3 MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("   V3 getTotalAssets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  
  console.log("\n2. WToken State:");
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  console.log("   My wToken:", ethers.utils.formatEther(wTokenBal));
  console.log("   Total supply:", ethers.utils.formatEther(totalSupply));
  
  // Try to withdraw wToken (this calls closePosition which has the bug)
  // But first let's inject MIM into LeverageAMM to cover the shortfall
  
  const debt = await leverageAMM.totalDebt();
  console.log("\n3. Debt to repay:", ethers.utils.formatEther(debt));
  console.log("   MIM in LeverageAMM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  // The closePosition bug: it transfers MIM to stakingVault, then calls repay() which tries to transferFrom again
  // We need to inject extra MIM to cover the double-transfer
  
  const myMIM = await mim.balanceOf(signer.address);
  console.log("   My MIM:", ethers.utils.formatEther(myMIM));
  
  // We have ~11 MIM, we need to cover the debt (~0.3 MIM for the wToken position)
  // Let's inject some MIM into LeverageAMM
  const injectAmount = ethers.utils.parseEther("1"); // Inject 1 MIM
  
  if (myMIM.gte(injectAmount) && wTokenBal.gt(0)) {
    console.log("\n4. Injecting MIM to cover double-transfer bug...");
    await (await mim.transfer(LEVERAGE_AMM, injectAmount)).wait();
    console.log("   ✓ Injected", ethers.utils.formatEther(injectAmount), "MIM to LeverageAMM");
    
    console.log("\n5. Attempting wToken withdrawal...");
    try {
      const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
      await tx.wait();
      console.log("   ✓ Withdrawal succeeded!");
      
      console.log("\n6. Final balances:");
      console.log("   sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
      console.log("   MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
    } catch (err: any) {
      console.log("   ✗ Withdrawal failed:", err.reason || err.message?.slice(0, 200));
      
      // Check LeverageAMM MIM balance now
      console.log("   LeverageAMM MIM after:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
    }
  } else if (wTokenBal.eq(0)) {
    console.log("\n   No wToken to withdraw");
  } else {
    console.log("\n   Not enough MIM to inject");
  }
  
  // Check StakingVault cash after
  const stakingVault = new ethers.Contract(STAKING_VAULT, ["function getCash() view returns (uint256)"], signer);
  console.log("\n7. StakingVault cash now:", ethers.utils.formatEther(await stakingVault.getCash()));
}
main().catch(console.error);
