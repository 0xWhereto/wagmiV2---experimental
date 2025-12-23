import { ethers } from "hardhat";

const ADDRESSES = {
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  SMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",
  LEVERAGE_AMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  WETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7"
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== 0IL Bug Verification ===\n");

  // Check MIM decimals
  const mim = await ethers.getContractAt("IERC20Metadata", ADDRESSES.MIM);
  const mimDecimals = await mim.decimals();
  console.log("MIM Decimals:", mimDecimals.toString());

  // Check sMIM decimals
  const smim = await ethers.getContractAt("IERC20Metadata", ADDRESSES.SMIM);
  const smimDecimals = await smim.decimals();
  console.log("sMIM Decimals:", smimDecimals.toString());
  console.log("BUG-001 Decimal Mismatch:", Number(mimDecimals) !== Number(smimDecimals) ? "CONFIRMED" : "NOT AN ISSUE - Both 18 decimals");

  // Check sMIM vault functions
  console.log("\n--- Testing sMIM Vault Functions ---");
  const smimVault = new ethers.Contract(ADDRESSES.SMIM, [
    "function totalAssets() view returns (uint256)",
    "function getCash() view returns (uint256)",
    "function totalBorrowed() view returns (uint256)",
    "function availableLiquidity() view returns (uint256)",
    "function maxWithdraw(address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function mim() view returns (address)",
    "function asset() view returns (address)"
  ], signer);

  try {
    const totalAssets = await smimVault.totalAssets();
    console.log("✅ totalAssets():", ethers.utils.formatUnits(totalAssets, 18), "MIM");
  } catch (e: any) {
    console.log("❌ totalAssets() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const cash = await smimVault.getCash();
    console.log("✅ getCash():", ethers.utils.formatUnits(cash, 18), "MIM");
  } catch (e: any) {
    console.log("❌ getCash() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const borrowed = await smimVault.totalBorrowed();
    console.log("✅ totalBorrowed():", ethers.utils.formatUnits(borrowed, 18), "MIM");
  } catch (e: any) {
    console.log("❌ totalBorrowed() REVERTS - function may not exist in this version");
  }

  try {
    const liquidity = await smimVault.availableLiquidity();
    console.log("✅ availableLiquidity():", ethers.utils.formatUnits(liquidity, 18), "MIM");
  } catch (e: any) {
    console.log("❌ availableLiquidity() REVERTS - function may not exist in this version");
  }

  try {
    const totalSupply = await smimVault.totalSupply();
    console.log("✅ totalSupply():", ethers.utils.formatUnits(totalSupply, 18), "sMIM");
  } catch (e: any) {
    console.log("❌ totalSupply() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const mimAddr = await smimVault.mim();
    console.log("✅ mim() address:", mimAddr);
  } catch (e: any) {
    // Try asset() instead (ERC4626 standard)
    try {
      const assetAddr = await smimVault.asset();
      console.log("✅ asset() address:", assetAddr);
    } catch (e2: any) {
      console.log("❌ Neither mim() nor asset() works");
    }
  }

  // Check user balance and max withdraw
  const userBalance = await smimVault.balanceOf(signer.address);
  console.log("\nUser sMIM balance:", ethers.utils.formatUnits(userBalance, 18));

  try {
    const maxW = await smimVault.maxWithdraw(signer.address);
    console.log("✅ maxWithdraw():", ethers.utils.formatUnits(maxW, 18), "MIM");
    console.log("BUG-004 Withdrawal:", "CAN TEST - maxWithdraw returned value");
  } catch (e: any) {
    console.log("❌ maxWithdraw() REVERTS:", e.message?.slice(0, 100));
    console.log("BUG-004 Withdrawal: POTENTIALLY BROKEN");
  }

  // Check LeverageAMM weekly payment
  console.log("\n--- LeverageAMM State ---");
  const leverageAMM = new ethers.Contract(ADDRESSES.LEVERAGE_AMM, [
    "function lastWeeklyPayment() view returns (uint256)",
    "function accumulatedFees() view returns (uint256)",
    "function totalDebt() view returns (uint256)",
    "function weeklyInterestRate() view returns (uint256)",
    "function mim() view returns (address)",
    "function stakingVault() view returns (address)"
  ], signer);

  try {
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const lastDate = new Date(Number(lastPayment) * 1000);
    const now = Math.floor(Date.now() / 1000);
    const daysSince = (now - Number(lastPayment)) / 86400;
    
    console.log("Last Weekly Payment:", lastDate.toISOString());
    console.log("Days Since Payment:", daysSince.toFixed(2));
    console.log("BUG-002 Never Initialized:", Number(lastPayment) === 0 ? "CONFIRMED - epoch 0" : "NOT AN ISSUE");
  } catch (e: any) {
    console.log("❌ lastWeeklyPayment() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const fees = await leverageAMM.accumulatedFees();
    console.log("Accumulated Fees:", ethers.utils.formatUnits(fees, 18), "MIM");
  } catch (e: any) {
    console.log("❌ accumulatedFees() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const debt = await leverageAMM.totalDebt();
    console.log("Total Debt:", ethers.utils.formatUnits(debt, 18), "MIM");
  } catch (e: any) {
    console.log("❌ totalDebt() REVERTS:", e.message?.slice(0, 100));
  }

  try {
    const rate = await leverageAMM.weeklyInterestRate();
    console.log("Weekly Interest Rate:", Number(rate) / 100, "%");
  } catch (e: any) {
    console.log("❌ weeklyInterestRate() - function may not exist");
  }

  // Check MIM balance in vault
  const mimInVault = await mim.balanceOf(ADDRESSES.SMIM);
  console.log("\nMIM in Staking Vault:", ethers.utils.formatUnits(mimInVault, 18), "MIM");

  // Check LeverageAMM config
  try {
    const ammMim = await leverageAMM.mim();
    const ammVault = await leverageAMM.stakingVault();
    console.log("\nLeverageAMM.mim():", ammMim);
    console.log("LeverageAMM.stakingVault():", ammVault);
    console.log("Config matches:", ammMim === ADDRESSES.MIM && ammVault === ADDRESSES.SMIM ? "YES" : "MISMATCH!");
  } catch (e: any) {
    console.log("❌ Failed to check LeverageAMM config");
  }

  console.log("\n=== Summary ===");
  console.log("BUG-001: Decimal Mismatch - " + (Number(mimDecimals) !== Number(smimDecimals) ? "CONFIRMED" : "NOT AN ISSUE (both 18 decimals)"));
  console.log("BUG-002: Weekly Payment - Check lastWeeklyPayment above");
  console.log("BUG-003: Vault Functions - Check individual function results above");
  console.log("BUG-004: Withdrawal - Check maxWithdraw result above");
}

main().catch(console.error);
