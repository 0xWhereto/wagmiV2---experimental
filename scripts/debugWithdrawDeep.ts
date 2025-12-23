import { ethers } from "hardhat";

const V3_VAULT = "0xC4AC36c923658F9281bFEF592f36A2EC5101b19a";
const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug Withdraw Deep ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const leverageAMM = (await ethers.getContractFactory("LeverageAMM")).attach(LEVERAGE_AMM);
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  
  console.log("1. WToken state:");
  console.log("   My balance:", ethers.utils.formatEther(wTokenBal));
  console.log("   Total supply:", ethers.utils.formatEther(totalSupply));
  
  console.log("\n2. LeverageAMM state:");
  console.log("   totalDebt:", ethers.utils.formatEther(await leverageAMM.totalDebt()));
  console.log("   sWETH balance:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  console.log("   MIM balance:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  console.log("\n3. V3LPVault state:");
  const [a0, a1] = await v3Vault.getTotalAssets();
  console.log("   getTotalAssets:", ethers.utils.formatEther(a0), "sWETH,", ethers.utils.formatEther(a1), "MIM");
  console.log("   sWETH balance:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("   MIM balance:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  
  // Calculate what closePosition would do
  console.log("\n4. Simulating closePosition calculation:");
  const shares = wTokenBal;
  const withdrawPercent = shares.mul(ethers.utils.parseEther("1")).div(totalSupply);
  console.log("   withdrawPercent:", ethers.utils.formatEther(withdrawPercent), "(", (parseFloat(ethers.utils.formatEther(withdrawPercent)) * 100).toFixed(2), "%)");
  
  const debtToRepay = (await leverageAMM.totalDebt()).mul(withdrawPercent).div(ethers.utils.parseEther("1"));
  console.log("   debtToRepay:", ethers.utils.formatEther(debtToRepay));
  
  // What would V3LPVault.removeLiquidity return?
  const basisPoints = withdrawPercent.mul(10000).div(ethers.utils.parseEther("1"));
  console.log("   removeLiquidity basisPoints:", basisPoints.toString());
  
  // Try calling removeLiquidity directly as owner to see what we get
  console.log("\n5. Testing V3LPVault.removeLiquidity as owner...");
  try {
    // Static call first
    const [amount0, amount1] = await v3Vault.callStatic.removeLiquidity(basisPoints, 0, 0);
    console.log("   Would receive:", ethers.utils.formatEther(amount0), "sWETH,", ethers.utils.formatEther(amount1), "MIM");
    console.log("   MIM sufficient to repay debt?", amount1.gte(debtToRepay) ? "✓ Yes" : "✗ No");
    
    if (amount1.lt(debtToRepay)) {
      const shortfall = debtToRepay.sub(amount1);
      console.log("   MIM shortfall:", ethers.utils.formatEther(shortfall));
    }
  } catch (e: any) {
    console.log("   removeLiquidity static call failed:", e.message?.slice(0, 150));
  }
  
  // Try calling wToken.withdraw static call to get detailed error
  console.log("\n6. WToken.withdraw static call...");
  try {
    await wToken.callStatic.withdraw(wTokenBal, 0);
    console.log("   ✓ Static call succeeded!");
  } catch (err: any) {
    console.log("   ✗ Static call failed");
    console.log("   Reason:", err.reason || "none");
    console.log("   Error data:", err.data || "none");
    
    // Try to decode
    const errorSelectors: { [key: string]: string } = {
      "0xa0640723": "ExceedsMaxUtilization()",
      "0xe450d38c": "ERC20InsufficientBalance(address,uint256,uint256)",
      "0xfb8f41b2": "ERC20InsufficientAllowance(address,uint256,uint256)",
      "0x2703feb0": "NotWToken()",
      "0x7c214f04": "NotOperator()",
      "0x8199f5f3": "SlippageExceeded()",
    };
    
    if (err.data && errorSelectors[err.data.slice(0, 10)]) {
      console.log("   Decoded error:", errorSelectors[err.data.slice(0, 10)]);
    }
  }
}
main().catch(console.error);
