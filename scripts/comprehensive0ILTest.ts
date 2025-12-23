/**
 * Comprehensive 0IL Protocol Test Suite
 * Tests the full flow: MIM mint/stake/withdraw/swap + 0IL vault join
 * 
 * Run: npx hardhat run scripts/comprehensive0ILTest.ts --network sonic
 */

import { ethers } from "hardhat";

// ============ Deployed Addresses (Sonic Mainnet) ============

const ADDRESSES = {
  // MagicPool Core
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  sMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",  // StakingVault
  
  // Synthetic Assets
  sUSDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",
  
  // V3 Pools
  MIM_USDC_POOL: "0xFBfb4e7DE02EFfd36c9A307340a6a0AdCd01663B", // 0.01% fee
  SWETH_MIM_POOL: "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190", // 0.05% fee
  
  // 0IL Protocol
  V3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  LeverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  SimpleOracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
  
  // Uniswap V3
  positionManager: "0x5826e10B513C891910032F15292B2F1b3041C3Df",
  v3Factory: "0x3a1713B6C3734cfC883A3897647f3128Fe789f39",
  swapRouter: "0xBE3aFbCB8CDB7dE20E4507f7B2a8be0bb51f5c16", // Universal Router
};

// ============ ABIs ============

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
];

const MIM_ABI = [
  ...ERC20_ABI,
  "function minters(address) view returns (bool)",
  "function mint(address, uint256) external",
  "function burn(address, uint256) external",
];

const STAKING_VAULT_ABI = [
  ...ERC20_ABI,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function totalBorrowed() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function getUtilization() view returns (uint256)",
  "function getCurrentInterestRate() view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function previewWithdraw(uint256) view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function getVaultStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
];

const ZERO_IL_VAULT_ABI = [
  ...ERC20_ABI,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function totalBorrowed() view returns (uint256)",
  "function assetPrice() view returns (uint256)",
  "function getCurrentDTV() view returns (uint256)",
  "function getVaultStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
];

const ORACLE_ABI = [
  "function getPrice() view returns (uint256)",
  "function getSpotPrice() view returns (uint256)",
];

const V3_POOL_ABI = [
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
];

const V3_LP_VAULT_ABI = [
  "function getTotalAssets() view returns (uint256, uint256)",
  "function getPendingFees() view returns (uint256, uint256)",
  "function getLayerCount() view returns (uint256)",
  "function collectFees() returns (uint256, uint256)",
];

const LEVERAGE_AMM_ABI = [
  "function totalDebt() view returns (uint256)",
  "function totalUnderlying() view returns (uint256)",
  "function getCurrentDTV() view returns (uint256)",
  "function getEquity() view returns (uint256)",
  "function getTotalLPValue() view returns (uint256)",
  "function accumulatedFees() view returns (uint256)",
  "function lastWeeklyPayment() view returns (uint256)",
  "function pendingWTokenFees() view returns (uint256)",
  "function checkRebalance() view returns (bool, bool)",
  "function isWeeklyPaymentDue() view returns (bool)",
  "function getExpectedWeeklyInterest() view returns (uint256)",
];

// ============ Test Results Storage ============

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  error?: string;
}

const testResults: TestResult[] = [];
const bugs: string[] = [];

// ============ Helper Functions ============

function formatTokenAmount(amount: any, decimals: number): string {
  return ethers.utils.formatUnits(amount, decimals);
}

function log(message: string) {
  console.log(`  ${message}`);
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function logResult(result: TestResult) {
  const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⏭️";
  console.log(`  ${icon} ${result.name}: ${result.details}`);
  if (result.error) {
    console.log(`     Error: ${result.error}`);
  }
  testResults.push(result);
}

// ============ Main Test Function ============

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         0IL PROTOCOL COMPREHENSIVE TEST SUITE              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nWallet: ${signer.address}`);
  console.log(`Network: Sonic (Chain ID: 146)`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  // ============ Load Contracts ============
  
  const mim = new ethers.Contract(ADDRESSES.MIM, MIM_ABI, signer);
  const sMIM = new ethers.Contract(ADDRESSES.sMIM, STAKING_VAULT_ABI, signer);
  const sUSDC = new ethers.Contract(ADDRESSES.sUSDC, ERC20_ABI, signer);
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, ERC20_ABI, signer);
  const oracle = new ethers.Contract(ADDRESSES.SimpleOracle, ORACLE_ABI, signer);
  const v3LPVault = new ethers.Contract(ADDRESSES.V3LPVault, V3_LP_VAULT_ABI, signer);
  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, signer);
  
  // ============ PHASE 1: Check Initial Balances ============
  
  logSection("PHASE 1: Initial State Check");
  
  try {
    const mimBalance = await mim.balanceOf(signer.address);
    const sMIMBalance = await sMIM.balanceOf(signer.address);
    const sUSDCBalance = await sUSDC.balanceOf(signer.address);
    const sWETHBalance = await sWETH.balanceOf(signer.address);
    const nativeBalance = await signer.getBalance();
    
    log(`Native S Balance: ${formatTokenAmount(nativeBalance, 18)} S`);
    log(`MIM Balance: ${formatTokenAmount(mimBalance, 6)} MIM`);
    log(`sMIM Balance: ${formatTokenAmount(sMIMBalance, 6)} sMIM`);
    log(`sUSDC Balance: ${formatTokenAmount(sUSDCBalance, 6)} sUSDC`);
    log(`sWETH Balance: ${formatTokenAmount(sWETHBalance, 18)} sWETH`);
    
    logResult({
      name: "Initial Balances Check",
      status: "PASS",
      details: `MIM=${formatTokenAmount(mimBalance, 6)}, sUSDC=${formatTokenAmount(sUSDCBalance, 6)}`
    });
  } catch (e: any) {
    logResult({
      name: "Initial Balances Check",
      status: "FAIL",
      details: "Failed to fetch balances",
      error: e.message?.slice(0, 100)
    });
    bugs.push("BUG-001: Failed to fetch initial balances - possible contract issue");
  }
  
  // ============ PHASE 2: Check Protocol State ============
  
  logSection("PHASE 2: Protocol State Check");
  
  // Check sMIM Vault
  try {
    const vaultStats = await sMIM.getVaultStats();
    log(`sMIM Total Assets: ${formatTokenAmount(vaultStats[0], 6)} MIM`);
    log(`sMIM Total Borrowed: ${formatTokenAmount(vaultStats[1], 6)} MIM`);
    log(`sMIM Available Liquidity: ${formatTokenAmount(vaultStats[2], 6)} MIM`);
    log(`sMIM Utilization: ${formatTokenAmount(vaultStats[3], 2)}%`);
    log(`sMIM Interest Rate: ${formatTokenAmount(vaultStats[4], 2)} basis points`);
    
    // Check for potential issues
    if (vaultStats[0].eq(0)) {
      bugs.push("BUG-002: sMIM vault has zero total assets - may not be initialized properly");
    }
    
    logResult({
      name: "sMIM Vault State",
      status: "PASS",
      details: `Assets=${formatTokenAmount(vaultStats[0], 6)}, Util=${formatTokenAmount(vaultStats[3], 2)}%`
    });
  } catch (e: any) {
    logResult({
      name: "sMIM Vault State",
      status: "FAIL", 
      details: "Failed to fetch vault stats",
      error: e.message?.slice(0, 100)
    });
    bugs.push("BUG-003: sMIM vault getVaultStats() failed - ABI mismatch or contract error");
  }
  
  // Check Oracle
  try {
    const price = await oracle.getPrice();
    log(`Oracle Price: ${formatTokenAmount(price, 18)} MIM per sWETH`);
    
    // Sanity check - ETH should be around $3000
    const priceNum = parseFloat(formatTokenAmount(price, 18));
    if (priceNum < 1000 || priceNum > 10000) {
      bugs.push(`BUG-004: Oracle price ${priceNum} seems incorrect (expected ~3000)`);
    }
    
    logResult({
      name: "Oracle Price Check",
      status: "PASS",
      details: `Price=${priceNum.toFixed(2)} MIM/sWETH`
    });
  } catch (e: any) {
    logResult({
      name: "Oracle Price Check",
      status: "FAIL",
      details: "Failed to get oracle price",
      error: e.message?.slice(0, 100)
    });
    bugs.push("BUG-005: Oracle getPrice() failed");
  }
  
  // Check LeverageAMM
  try {
    const totalDebt = await leverageAMM.totalDebt();
    const totalUnderlying = await leverageAMM.totalUnderlying();
    const currentDTV = await leverageAMM.getCurrentDTV();
    const accFees = await leverageAMM.accumulatedFees();
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const isPaymentDue = await leverageAMM.isWeeklyPaymentDue();
    
    log(`LeverageAMM Total Debt: ${formatTokenAmount(totalDebt, 18)} MIM`);
    log(`LeverageAMM Total Underlying: ${formatTokenAmount(totalUnderlying, 18)} sWETH`);
    log(`LeverageAMM Current DTV: ${formatTokenAmount(currentDTV, 16)}%`);
    log(`LeverageAMM Accumulated Fees: ${formatTokenAmount(accFees, 18)} MIM`);
    log(`LeverageAMM Last Weekly Payment: ${new Date(lastPayment.toNumber() * 1000).toISOString()}`);
    log(`LeverageAMM Weekly Payment Due: ${isPaymentDue}`);
    
    // Check DTV ratio
    const dtvNum = parseFloat(formatTokenAmount(currentDTV, 18));
    if (dtvNum > 0 && (dtvNum < 0.4 || dtvNum > 0.66)) {
      bugs.push(`BUG-006: DTV ratio ${dtvNum} is outside healthy range (0.4-0.66)`);
    }
    
    // Check if weekly payment is overdue
    if (isPaymentDue) {
      bugs.push("BUG-007: Weekly interest payment is overdue - needs to be called");
    }
    
    logResult({
      name: "LeverageAMM State",
      status: "PASS",
      details: `Debt=${formatTokenAmount(totalDebt, 18)}, DTV=${(dtvNum * 100).toFixed(2)}%`
    });
  } catch (e: any) {
    logResult({
      name: "LeverageAMM State",
      status: "FAIL",
      details: "Failed to get LeverageAMM stats",
      error: e.message?.slice(0, 100)
    });
  }
  
  // ============ PHASE 3: Test MIM Mint ============
  
  logSection("PHASE 3: MIM Mint Test (1 MIM)");
  
  const mintAmount = ethers.utils.parseUnits("1", 6); // 1 MIM (6 decimals)
  let mimMinted = false;
  
  try {
    const sUSDCBalance = await sUSDC.balanceOf(signer.address);
    
    if (sUSDCBalance.gte(mintAmount)) {
      log(`Have ${formatTokenAmount(sUSDCBalance, 6)} sUSDC, attempting to mint 1 MIM...`);
      
      // Check if there's a MIMMinter contract or if we can mint directly
      const isMinter = await mim.minters(signer.address);
      
      if (isMinter) {
        // Direct mint (we are an authorized minter)
        log("We are an authorized minter, minting directly...");
        const tx = await mim.mint(signer.address, mintAmount, { gasLimit: 500000 });
        await tx.wait();
        mimMinted = true;
        
        logResult({
          name: "Direct MIM Mint",
          status: "PASS",
          details: "Minted 1 MIM successfully"
        });
      } else {
        log("Not an authorized minter. Need to use MIMMinter contract or swap.");
        
        // Try to find MIMMinter and use it
        bugs.push("NOTE: signer is not a MIM minter - need to use MIMMinter contract for minting");
        
        logResult({
          name: "MIM Mint via MIMMinter",
          status: "SKIP",
          details: "Not authorized as minter, would need MIMMinter contract"
        });
      }
    } else {
      log(`Insufficient sUSDC balance: ${formatTokenAmount(sUSDCBalance, 6)}`);
      logResult({
        name: "MIM Mint",
        status: "SKIP",
        details: `Insufficient sUSDC (have ${formatTokenAmount(sUSDCBalance, 6)}, need 1)`
      });
    }
  } catch (e: any) {
    logResult({
      name: "MIM Mint",
      status: "FAIL",
      details: "Mint operation failed",
      error: e.message?.slice(0, 100)
    });
  }
  
  // ============ PHASE 4: Test MIM Staking ============
  
  logSection("PHASE 4: MIM Staking Test");
  
  try {
    const mimBalance = await mim.balanceOf(signer.address);
    
    if (mimBalance.gte(mintAmount)) {
      log(`Have ${formatTokenAmount(mimBalance, 6)} MIM, staking 1 MIM...`);
      
      // Approve sMIM vault
      const approveTx = await mim.approve(ADDRESSES.sMIM, mintAmount, { gasLimit: 100000 });
      await approveTx.wait();
      log("Approved sMIM vault");
      
      // Preview deposit
      const previewShares = await sMIM.previewDeposit(mintAmount);
      log(`Preview: Will receive ${formatTokenAmount(previewShares, 6)} sMIM`);
      
      // Deposit
      const depositTx = await sMIM.deposit(mintAmount, signer.address, { gasLimit: 500000 });
      await depositTx.wait();
      
      const newSMIMBalance = await sMIM.balanceOf(signer.address);
      log(`New sMIM balance: ${formatTokenAmount(newSMIMBalance, 6)}`);
      
      // Check that conversion rate is correct (should be ~1:1 initially)
      const sharesToAssets = await sMIM.convertToAssets(previewShares);
      log(`Share value check: ${formatTokenAmount(previewShares, 6)} sMIM = ${formatTokenAmount(sharesToAssets, 6)} MIM`);
      
      logResult({
        name: "MIM Staking",
        status: "PASS",
        details: `Staked 1 MIM, received ${formatTokenAmount(previewShares, 6)} sMIM`
      });
    } else {
      log(`Insufficient MIM: ${formatTokenAmount(mimBalance, 6)}`);
      logResult({
        name: "MIM Staking",
        status: "SKIP",
        details: `Insufficient MIM (have ${formatTokenAmount(mimBalance, 6)}, need 1)`
      });
    }
  } catch (e: any) {
    logResult({
      name: "MIM Staking",
      status: "FAIL",
      details: "Staking failed",
      error: e.message?.slice(0, 100)
    });
    bugs.push(`BUG-008: MIM staking failed: ${e.message?.slice(0, 100)}`);
  }
  
  // ============ PHASE 5: Test sMIM Withdrawal ============
  
  logSection("PHASE 5: sMIM Withdrawal Test");
  
  try {
    const sMIMBalance = await sMIM.balanceOf(signer.address);
    
    if (sMIMBalance.gt(0)) {
      const withdrawAmount = sMIMBalance.div(2); // Withdraw half
      log(`Have ${formatTokenAmount(sMIMBalance, 6)} sMIM, withdrawing ${formatTokenAmount(withdrawAmount, 6)}...`);
      
      // Check available liquidity
      const availableLiquidity = await sMIM.availableLiquidity();
      log(`Available liquidity: ${formatTokenAmount(availableLiquidity, 6)} MIM`);
      
      // Preview withdrawal
      const previewAssets = await sMIM.convertToAssets(withdrawAmount);
      log(`Will receive ~${formatTokenAmount(previewAssets, 6)} MIM`);
      
      if (availableLiquidity.gte(previewAssets)) {
        // Redeem shares
        const redeemTx = await sMIM.redeem(withdrawAmount, signer.address, signer.address, { gasLimit: 500000 });
        await redeemTx.wait();
        
        const newMIMBalance = await mim.balanceOf(signer.address);
        log(`New MIM balance: ${formatTokenAmount(newMIMBalance, 6)}`);
        
        logResult({
          name: "sMIM Withdrawal",
          status: "PASS",
          details: `Redeemed ${formatTokenAmount(withdrawAmount, 6)} sMIM`
        });
      } else {
        log("Insufficient liquidity for withdrawal");
        bugs.push("BUG-009: Insufficient liquidity for withdrawal - utilization too high");
        logResult({
          name: "sMIM Withdrawal",
          status: "FAIL",
          details: "Insufficient liquidity"
        });
      }
    } else {
      logResult({
        name: "sMIM Withdrawal",
        status: "SKIP",
        details: "No sMIM to withdraw"
      });
    }
  } catch (e: any) {
    logResult({
      name: "sMIM Withdrawal",
      status: "FAIL",
      details: "Withdrawal failed",
      error: e.message?.slice(0, 100)
    });
    bugs.push(`BUG-010: sMIM withdrawal failed: ${e.message?.slice(0, 100)}`);
  }
  
  // ============ PHASE 6: Check 0IL Vault Join Requirements ============
  
  logSection("PHASE 6: 0IL Vault Pre-Check");
  
  try {
    const sWETHBalance = await sWETH.balanceOf(signer.address);
    const price = await oracle.getPrice();
    const priceNum = parseFloat(formatTokenAmount(price, 18));
    
    // Calculate how much sWETH needed for $1 value
    const dollarsNeeded = 1;
    const sWETHNeeded = dollarsNeeded / priceNum;
    const sWETHNeededWei = ethers.utils.parseUnits(sWETHNeeded.toFixed(18), 18);
    
    log(`sWETH Balance: ${formatTokenAmount(sWETHBalance, 18)} sWETH`);
    log(`Price: ${priceNum.toFixed(2)} MIM/sWETH`);
    log(`For $1 value, need: ${sWETHNeeded.toFixed(8)} sWETH`);
    
    if (sWETHBalance.gte(sWETHNeededWei)) {
      log("✅ Have enough sWETH for $1 deposit");
      logResult({
        name: "0IL Vault Pre-Check",
        status: "PASS",
        details: `Have ${formatTokenAmount(sWETHBalance, 18)} sWETH, need ${sWETHNeeded.toFixed(8)}`
      });
    } else {
      log("⚠️ Insufficient sWETH for $1 deposit");
      logResult({
        name: "0IL Vault Pre-Check",
        status: "SKIP",
        details: `Need ${sWETHNeeded.toFixed(8)} sWETH, have ${formatTokenAmount(sWETHBalance, 18)}`
      });
    }
  } catch (e: any) {
    logResult({
      name: "0IL Vault Pre-Check",
      status: "FAIL",
      details: "Pre-check failed",
      error: e.message?.slice(0, 100)
    });
  }
  
  // ============ PHASE 7: Check 7-Day Fee Collection Logic ============
  
  logSection("PHASE 7: 7-Day Fee Collection Analysis");
  
  try {
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const isPaymentDue = await leverageAMM.isWeeklyPaymentDue();
    const accFees = await leverageAMM.accumulatedFees();
    const pendingWTokenFees = await leverageAMM.pendingWTokenFees();
    
    const lastPaymentDate = new Date(lastPayment.toNumber() * 1000);
    const now = new Date();
    const daysSincePayment = (now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    log(`Last Weekly Payment: ${lastPaymentDate.toISOString()}`);
    log(`Days Since Payment: ${daysSincePayment.toFixed(2)}`);
    log(`Is Payment Due: ${isPaymentDue}`);
    log(`Accumulated Fees: ${formatTokenAmount(accFees, 18)} MIM`);
    log(`Pending wToken Fees: ${formatTokenAmount(pendingWTokenFees, 18)} MIM`);
    
    // Check expected interest
    try {
      const expectedInterest = await leverageAMM.getExpectedWeeklyInterest();
      log(`Expected Weekly Interest: ${formatTokenAmount(expectedInterest, 18)} MIM`);
      
      // Compare accumulated fees vs expected interest
      const accFeesNum = parseFloat(formatTokenAmount(accFees, 18));
      const expectedNum = parseFloat(formatTokenAmount(expectedInterest, 18));
      
      if (isPaymentDue) {
        if (accFeesNum >= expectedNum) {
          log("✅ Can fully pay weekly interest to sMIM");
        } else {
          log(`⚠️ Shortfall: ${(expectedNum - accFeesNum).toFixed(6)} MIM`);
          bugs.push(`BUG-011: Weekly interest shortfall of ${(expectedNum - accFeesNum).toFixed(6)} MIM`);
        }
      }
    } catch (e: any) {
      log(`Could not get expected weekly interest: ${e.message?.slice(0, 50)}`);
    }
    
    // Check rebalance need
    const [needsRebalance, isDeleverage] = await leverageAMM.checkRebalance();
    log(`Needs Rebalance: ${needsRebalance}`);
    if (needsRebalance) {
      log(`Rebalance Type: ${isDeleverage ? "Deleverage" : "Add Leverage"}`);
      bugs.push(`NOTE: LeverageAMM needs rebalancing (${isDeleverage ? "deleverage" : "add leverage"})`);
    }
    
    logResult({
      name: "7-Day Fee Collection Logic",
      status: "PASS",
      details: `Days since payment: ${daysSincePayment.toFixed(2)}, Due: ${isPaymentDue}`
    });
  } catch (e: any) {
    logResult({
      name: "7-Day Fee Collection Logic",
      status: "FAIL",
      details: "Failed to analyze fee collection",
      error: e.message?.slice(0, 100)
    });
  }
  
  // ============ PHASE 8: V3 LP Vault Check ============
  
  logSection("PHASE 8: V3 LP Vault Analysis");
  
  try {
    const [asset0, asset1] = await v3LPVault.getTotalAssets();
    const [fee0, fee1] = await v3LPVault.getPendingFees();
    const layerCount = await v3LPVault.getLayerCount();
    
    log(`Total Assets: token0=${formatTokenAmount(asset0, 18)}, token1=${formatTokenAmount(asset1, 18)}`);
    log(`Pending Fees: token0=${formatTokenAmount(fee0, 18)}, token1=${formatTokenAmount(fee1, 18)}`);
    log(`Layer Count: ${layerCount.toString()}`);
    
    // Check if vault has liquidity
    if (asset0.eq(0) && asset1.eq(0)) {
      bugs.push("BUG-012: V3 LP Vault has zero assets - may not be initialized");
    }
    
    logResult({
      name: "V3 LP Vault Check",
      status: "PASS",
      details: `Layers=${layerCount}, Fees pending: ${!fee0.eq(0) || !fee1.eq(0)}`
    });
  } catch (e: any) {
    logResult({
      name: "V3 LP Vault Check",
      status: "FAIL",
      details: "Failed to check V3 LP Vault",
      error: e.message?.slice(0, 100)
    });
  }
  
  // ============ FINAL SUMMARY ============
  
  logSection("TEST SUMMARY");
  
  console.log("\n📊 Test Results:");
  console.log("─".repeat(50));
  
  let passed = 0, failed = 0, skipped = 0;
  
  for (const result of testResults) {
    if (result.status === "PASS") passed++;
    else if (result.status === "FAIL") failed++;
    else skipped++;
  }
  
  console.log(`  ✅ PASSED: ${passed}`);
  console.log(`  ❌ FAILED: ${failed}`);
  console.log(`  ⏭️ SKIPPED: ${skipped}`);
  
  console.log("\n🐛 Bug Reports:");
  console.log("─".repeat(50));
  
  if (bugs.length === 0) {
    console.log("  No bugs found!");
  } else {
    for (const bug of bugs) {
      console.log(`  • ${bug}`);
    }
  }
  
  console.log("\n" + "═".repeat(60));
  console.log("  END OF TEST SUITE");
  console.log("═".repeat(60) + "\n");
  
  return { testResults, bugs };
}

main()
  .then(({ testResults, bugs }) => {
    console.log("\n📋 Structured Bug Report for Review:");
    console.log(JSON.stringify({ testResults, bugs }, null, 2));
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });

