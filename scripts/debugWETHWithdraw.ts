import { ethers } from "hardhat";

const USER = "0x4151E05ABe56192e2A6775612C2020509Fd50637";
const WETH_VAULT = "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7";
const LEVERAGE_AMM = "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508";
const V3LP_VAULT = "0x1139d155D39b2520047178444C51D3D70204650F";
const SWETH = "0x03B4E6C1C77fAC1C256EbF5AF79eB5CC1a29a6a1";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=== Debugging wETH Vault Withdrawal ===\n");
  console.log("User:", USER);
  console.log("Attempting to withdraw: 0.00125337 wETH shares\n");

  // wETH Vault state
  const wethVault = new ethers.Contract(WETH_VAULT, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function totalDeposited() view returns (uint256)",
    "function convertToAssets(uint256) view returns (uint256)",
    "function withdrawalsPaused() view returns (bool)",
    "function leverageAMM() view returns (address)",
    "function underlyingAsset() view returns (address)"
  ], signer);

  console.log("--- wETH Vault State ---");
  
  try {
    const userBalance = await wethVault.balanceOf(USER);
    console.log("User wETH balance:", ethers.utils.formatUnits(userBalance, 18), "wETH");
    
    const sharesToWithdraw = ethers.BigNumber.from("1253372065806160");
    console.log("Shares to withdraw:", ethers.utils.formatUnits(sharesToWithdraw, 18));
    
    if (userBalance.lt(sharesToWithdraw)) {
      console.log("❌ INSUFFICIENT wETH BALANCE");
      return;
    }
    console.log("✅ User has enough shares");
  } catch (e: any) {
    console.log("Error getting user balance:", e.message?.slice(0, 100));
  }

  try {
    const totalSupply = await wethVault.totalSupply();
    console.log("Total Supply:", ethers.utils.formatUnits(totalSupply, 18), "wETH");
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 100));
  }

  try {
    const pricePerShare = await wethVault.pricePerShare();
    console.log("Price Per Share:", ethers.utils.formatUnits(pricePerShare, 18));
  } catch (e: any) {
    console.log("Error getting pricePerShare:", e.message?.slice(0, 100));
  }

  try {
    const paused = await wethVault.withdrawalsPaused();
    console.log("Withdrawals Paused:", paused);
    if (paused) {
      console.log("❌ WITHDRAWALS ARE PAUSED!");
      return;
    }
  } catch (e: any) {
    console.log("Error checking pause state:", e.message?.slice(0, 100));
  }

  try {
    const sharesToWithdraw = ethers.BigNumber.from("1253372065806160");
    const assetsOut = await wethVault.convertToAssets(sharesToWithdraw);
    console.log("Expected assets out:", ethers.utils.formatUnits(assetsOut, 18), "sWETH");
  } catch (e: any) {
    console.log("Error in convertToAssets:", e.message?.slice(0, 100));
  }

  // LeverageAMM state
  console.log("\n--- LeverageAMM State ---");
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)",
    "function getCurrentDTV() view returns (uint256)",
    "function v3Vault() view returns (address)",
    "function stakingVault() view returns (address)"
  ], signer);

  try {
    const totalDebt = await leverageAMM.totalDebt();
    console.log("Total Debt:", ethers.utils.formatUnits(totalDebt, 18), "MIM");
  } catch (e: any) {
    console.log("Error getting totalDebt:", e.message?.slice(0, 100));
  }

  try {
    const totalUnderlying = await leverageAMM.totalUnderlying();
    console.log("Total Underlying:", ethers.utils.formatUnits(totalUnderlying, 18), "sWETH");
  } catch (e: any) {
    console.log("Error getting totalUnderlying:", e.message?.slice(0, 100));
  }

  try {
    const dtv = await leverageAMM.getCurrentDTV();
    console.log("Current DTV:", (Number(dtv) / 1e16).toFixed(2), "%");
  } catch (e: any) {
    console.log("Error getting DTV:", e.message?.slice(0, 100));
  }

  // V3LPVault state
  console.log("\n--- V3LPVault State ---");
  const v3Vault = new ethers.Contract(V3LP_VAULT, [
    "function getTotalLiquidity() view returns (uint256 amount0, uint256 amount1)",
    "function pool() view returns (address)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ], signer);

  try {
    const [amount0, amount1] = await v3Vault.getTotalLiquidity();
    console.log("Total Liquidity - Token0:", ethers.utils.formatUnits(amount0, 18));
    console.log("Total Liquidity - Token1:", ethers.utils.formatUnits(amount1, 18));
  } catch (e: any) {
    console.log("Error getting liquidity:", e.message?.slice(0, 100));
  }

  // Check sWETH and MIM balances in V3LPVault
  const sweth = await ethers.getContractAt("IERC20", SWETH);
  const mim = await ethers.getContractAt("IERC20", MIM);
  
  console.log("\n--- Token Balances in V3LPVault ---");
  const swethInVault = await sweth.balanceOf(V3LP_VAULT);
  const mimInVault = await mim.balanceOf(V3LP_VAULT);
  console.log("sWETH in V3LPVault:", ethers.utils.formatUnits(swethInVault, 18));
  console.log("MIM in V3LPVault:", ethers.utils.formatUnits(mimInVault, 18));

  // Try to simulate the withdrawal
  console.log("\n--- Simulating Withdrawal ---");
  const wethWithUser = new ethers.Contract(WETH_VAULT, [
    "function withdraw(uint256 shares, uint256 minAssets) returns (uint256)"
  ], signer);

  try {
    // Simulate with a callStatic
    const sharesToWithdraw = ethers.BigNumber.from("1253372065806160");
    await wethWithUser.callStatic.withdraw(sharesToWithdraw, 0, { from: USER });
    console.log("✅ Simulation passed - withdrawal should work");
  } catch (e: any) {
    console.log("❌ Simulation failed:", e.reason || e.message?.slice(0, 300));
    
    // Check specific error
    if (e.message?.includes("WithdrawalsPaused")) {
      console.log("Reason: Withdrawals are paused");
    } else if (e.message?.includes("InsufficientShares")) {
      console.log("Reason: User doesn't have enough shares");
    } else if (e.message?.includes("SlippageExceeded")) {
      console.log("Reason: Slippage exceeded");
    }
  }
}

main().catch(console.error);
