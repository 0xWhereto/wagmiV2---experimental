import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug Close Position ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const debt = await leverageAMM.totalDebt();
  const wTokenBal = await wToken.balanceOf(signer.address);
  const ammMIM = await mim.balanceOf(LEVERAGE_AMM);
  
  console.log("LeverageAMM debt:", ethers.utils.formatEther(debt));
  console.log("LeverageAMM MIM:", ethers.utils.formatEther(ammMIM));
  console.log("My wToken:", ethers.utils.formatEther(wTokenBal));
  
  // The bug: closePosition does:
  // 1. mim.safeTransfer(stakingVault, debtToRepay) - sends X MIM
  // 2. stakingVault.repay(debtToRepay) - which calls safeTransferFrom(leverageAMM, ..., debtToRepay) - tries to pull X MIM again
  // So we need 2X MIM in LeverageAMM to make this work
  
  // But also, we get MIM from removeLiquidity, so let's calculate:
  // After removeLiquidity: LeverageAMM gets ~0.9 MIM
  // Then it transfers 0.3 to stakingVault
  // Then repay tries to pull 0.3 from LeverageAMM
  // LeverageAMM has: 0.9 + 1.0 (injected) - 0.3 (transferred) = 1.6 MIM
  // Repay needs: 0.3 MIM from LeverageAMM
  // 1.6 >= 0.3, so it should work...
  
  // Unless repay pulls before closePosition gets the MIM? Let me try with more
  console.log("\nNeed to inject 2x debt =", ethers.utils.formatEther(debt.mul(2)));
  
  // Inject more MIM - need at least 2x debt
  const currentAMMBalance = await mim.balanceOf(LEVERAGE_AMM);
  const needed = debt.mul(2);
  const toInject = needed.sub(currentAMMBalance);
  
  if (toInject.gt(0)) {
    console.log("Injecting additional", ethers.utils.formatEther(toInject), "MIM...");
    await (await mim.transfer(LEVERAGE_AMM, toInject)).wait();
    console.log("✓ Injected. LeverageAMM MIM now:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  }
  
  // Try static call first
  console.log("\nStatic call withdraw...");
  try {
    await wToken.callStatic.withdraw(wTokenBal, 0);
    console.log("Static call succeeded!");
  } catch (err: any) {
    console.log("Static call failed:");
    console.log("  Error data:", err.data?.slice(0, 20) || "none");
    
    // Decode known errors
    const selectors: {[k:string]: string} = {
      "0xe450d38c": "ERC20InsufficientBalance(from, balance, needed)"
    };
    if (err.data && selectors[err.data.slice(0, 10)]) {
      console.log("  Error:", selectors[err.data.slice(0, 10)]);
      // Decode params
      try {
        const iface = new ethers.utils.Interface([
          "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)"
        ]);
        const decoded = iface.parseError(err.data);
        console.log("  Sender:", decoded.args[0]);
        console.log("  Balance:", ethers.utils.formatEther(decoded.args[1]));
        console.log("  Needed:", ethers.utils.formatEther(decoded.args[2]));
      } catch {}
    }
    return;
  }
  
  // Try actual withdrawal
  console.log("\nActual withdrawal...");
  const swethBefore = await sweth.balanceOf(signer.address);
  
  try {
    const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
    await tx.wait();
    console.log("✓ Withdrawal succeeded!");
    
    const swethAfter = await sweth.balanceOf(signer.address);
    console.log("sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
    
    // Check StakingVault cash
    const stakingVault = new ethers.Contract(STAKING_VAULT, ["function getCash() view returns (uint256)"], signer);
    console.log("StakingVault cash now:", ethers.utils.formatEther(await stakingVault.getCash()));
    
  } catch (err: any) {
    console.log("✗ Failed:", err.reason || err.message?.slice(0, 200));
  }
}
main().catch(console.error);
