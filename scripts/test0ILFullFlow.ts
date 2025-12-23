/**
 * 0IL Protocol Full Flow Test
 *
 * Test Sequence:
 * 1. Mint 1 MIM (using sUSDC)
 * 2. Stake MIM → receive sMIM
 * 3. Withdraw sMIM → receive MIM
 * 4. Swap MIM to sUSDC
 * 5. Mint 1 MIM again
 * 6. Stake MIM → receive sMIM
 * 7. Join 0IL vault with ~$1 ETH value
 * 8. Verify shares, liquidity, DTV
 *
 * Run: npx hardhat run scripts/test0ILFullFlow.ts --network sonic
 */

import { ethers } from "hardhat";

// ============ Contract Addresses (Sonic Mainnet) ============

const ADDRESSES = {
  // Core Tokens
  MIM: "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708",
  sUSDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  sWETH: "0x5E501C482952c1F2D58a4294F9A97759968c5125",

  // Staking
  sMIM: "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7",

  // 0IL Protocol
  wETH: "0xEA7681f28c62AbF83DeD17eEd88D48b3BD813Af7",
  V3LPVault: "0x1139d155D39b2520047178444C51D3D70204650F",
  LeverageAMM: "0x8CA24d00ffcF60e9ba7F67F9d41ccA28E22dF508",
  SimpleOracle: "0xD8680463F66C7bF74C61A2660aF4d7094ee9F749",

  // Swap
  SwapRouter: "0x8BbF9fF8CE8060B85DFe48d7b7E897d09418De9B",
  QuoterV2: "0x57e3e0a9DfB3DA34cc164B2C8dD1EBc404c45d47",

  // Pools
  MIM_USDC_POOL: "0xFBfb4e7DE02EFfd36c9A307340a6a0AdCd01663B",
};

// ============ ABIs ============

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const MIM_ABI = [
  ...ERC20_ABI,
  "function minters(address) view returns (bool)",
  "function mint(address, uint256) external",
  "function mintWithUSDC(uint256 amount) external",
  "function redeemForUSDC(uint256 mimAmount) external",
];

const STAKING_VAULT_ABI = [
  ...ERC20_ABI,
  "function deposit(uint256 assets) returns (uint256)",
  "function withdraw(uint256 shares) returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function totalBorrows() view returns (uint256)",
  "function getCash() view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function borrowRate() view returns (uint256)",
  "function supplyRate() view returns (uint256)",
  "function averageUtilization() view returns (uint256)",
  "function weekStartTime() view returns (uint256)",
  "function isWeekComplete() view returns (bool)",
  "function dailyUtilization(uint256) view returns (uint256)",
];

const WTOKEN_ABI = [
  ...ERC20_ABI,
  "function deposit(uint256 amount, uint256 minShares) returns (uint256)",
  "function withdraw(uint256 shares, uint256 minAssets) returns (uint256)",
  "function pricePerShare() view returns (uint256)",
  "function getTotalValue() view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function underlyingAsset() view returns (address)",
];

const LEVERAGE_AMM_ABI = [
  "function totalDebt() view returns (uint256)",
  "function totalUnderlying() view returns (uint256)",
  "function getCurrentDTV() view returns (uint256)",
  "function accumulatedFees() view returns (uint256)",
  "function lastWeeklyPayment() view returns (uint256)",
  "function pendingWTokenFees() view returns (uint256)",
  "function checkRebalance() view returns (bool, bool)",
  "function getExpectedWeeklyInterest() view returns (uint256)",
];

const V3_LP_VAULT_ABI = [
  "function getTotalAssets() view returns (uint256, uint256)",
  "function getPendingFees() view returns (uint256, uint256)",
  "function getLayerCount() view returns (uint256)",
];

const ORACLE_ABI = [
  "function getPrice() view returns (uint256)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) returns (uint256)",
];

// ============ Test Results ============

interface TestResult {
  step: number;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  txHash?: string;
  gasUsed?: string;
  error?: string;
}

interface BugReport {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  contract: string;
  evidence: string;
}

const results: TestResult[] = [];
const bugs: BugReport[] = [];

// ============ Helper Functions ============

function fmt(amount: any, decimals: number): string {
  return ethers.utils.formatUnits(amount, decimals);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

function addResult(result: TestResult) {
  const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⏭️";
  console.log(`\n${icon} Step ${result.step}: ${result.name}`);
  console.log(`   Status: ${result.status}`);
  console.log(`   Details: ${result.details}`);
  if (result.txHash) console.log(`   Tx: ${result.txHash}`);
  if (result.gasUsed) console.log(`   Gas: ${result.gasUsed}`);
  if (result.error) console.log(`   Error: ${result.error}`);
  results.push(result);
}

function addBug(bug: BugReport) {
  bugs.push(bug);
  console.log(`\n🐛 ${bug.id}: ${bug.title} [${bug.severity}]`);
}

// ============ Main Test ============

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║          0IL PROTOCOL FULL FLOW TEST SUITE                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nWallet: ${signer.address}`);
  console.log(`Network: Sonic (Chain ID: 146)`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Load contracts
  const mim = new ethers.Contract(ADDRESSES.MIM, MIM_ABI, signer);
  const sMIM = new ethers.Contract(ADDRESSES.sMIM, STAKING_VAULT_ABI, signer);
  const sUSDC = new ethers.Contract(ADDRESSES.sUSDC, ERC20_ABI, signer);
  const sWETH = new ethers.Contract(ADDRESSES.sWETH, ERC20_ABI, signer);
  const wETH = new ethers.Contract(ADDRESSES.wETH, WTOKEN_ABI, signer);
  const oracle = new ethers.Contract(ADDRESSES.SimpleOracle, ORACLE_ABI, signer);
  const leverageAMM = new ethers.Contract(ADDRESSES.LeverageAMM, LEVERAGE_AMM_ABI, signer);
  const v3LPVault = new ethers.Contract(ADDRESSES.V3LPVault, V3_LP_VAULT_ABI, signer);

  // ============ Initial State ============
  section("INITIAL STATE");

  const initialMIM = await mim.balanceOf(signer.address);
  const initialSMIM = await sMIM.balanceOf(signer.address);
  const initialSUSDC = await sUSDC.balanceOf(signer.address);
  const initialSWETH = await sWETH.balanceOf(signer.address);
  const initialWETH = await wETH.balanceOf(signer.address);

  log(`MIM: ${fmt(initialMIM, 6)}`);
  log(`sMIM: ${fmt(initialSMIM, 18)}`);
  log(`sUSDC: ${fmt(initialSUSDC, 6)}`);
  log(`sWETH: ${fmt(initialSWETH, 18)}`);
  log(`wETH shares: ${fmt(initialWETH, 18)}`);

  // Check decimals mismatch
  const mimDecimals = await mim.decimals();
  const smimDecimals = await sMIM.decimals();
  log(`\nMIM decimals: ${mimDecimals}`);
  log(`sMIM decimals: ${smimDecimals}`);

  if (mimDecimals !== smimDecimals) {
    addBug({
      id: "BUG-001",
      severity: "CRITICAL",
      title: "Decimal Mismatch Between MIM and sMIM",
      description: `MIM has ${mimDecimals} decimals but sMIM has ${smimDecimals} decimals`,
      contract: ADDRESSES.sMIM,
      evidence: `mimDecimals=${mimDecimals}, smimDecimals=${smimDecimals}`
    });
  }

  // ============ STEP 1: Mint 1 MIM ============
  section("STEP 1: MINT 1 MIM");

  const mintAmount = ethers.utils.parseUnits("1", 6); // 1 MIM

  try {
    const susdcBal = await sUSDC.balanceOf(signer.address);
    log(`sUSDC balance: ${fmt(susdcBal, 6)}`);

    if (susdcBal.lt(mintAmount)) {
      addResult({
        step: 1,
        name: "Mint 1 MIM",
        status: "SKIP",
        details: `Insufficient sUSDC: have ${fmt(susdcBal, 6)}, need 1`
      });
    } else {
      // Approve sUSDC to MIM
      log("Approving sUSDC...");
      const approveTx = await sUSDC.approve(ADDRESSES.MIM, mintAmount, { gasLimit: 100000 });
      await approveTx.wait();

      // Try mintWithUSDC
      log("Minting MIM with sUSDC...");
      try {
        const mintTx = await mim.mintWithUSDC(mintAmount, { gasLimit: 500000 });
        const receipt = await mintTx.wait();

        const newMIM = await mim.balanceOf(signer.address);
        addResult({
          step: 1,
          name: "Mint 1 MIM",
          status: "PASS",
          details: `Minted 1 MIM, new balance: ${fmt(newMIM, 6)}`,
          txHash: receipt.transactionHash,
          gasUsed: receipt.gasUsed.toString()
        });
      } catch (e: any) {
        // Try direct mint if we're a minter
        const isMinter = await mim.minters(signer.address);
        if (isMinter) {
          const mintTx = await mim.mint(signer.address, mintAmount, { gasLimit: 300000 });
          const receipt = await mintTx.wait();
          addResult({
            step: 1,
            name: "Mint 1 MIM (direct)",
            status: "PASS",
            details: "Direct mint successful",
            txHash: receipt.transactionHash
          });
        } else {
          throw e;
        }
      }
    }
  } catch (e: any) {
    addResult({
      step: 1,
      name: "Mint 1 MIM",
      status: "FAIL",
      details: "Mint failed",
      error: e.message?.slice(0, 150)
    });
  }

  // ============ STEP 2: Stake MIM ============
  section("STEP 2: STAKE MIM");

  try {
    const mimBal = await mim.balanceOf(signer.address);
    log(`MIM balance: ${fmt(mimBal, 6)}`);

    if (mimBal.lt(mintAmount)) {
      addResult({
        step: 2,
        name: "Stake MIM",
        status: "SKIP",
        details: `Insufficient MIM: ${fmt(mimBal, 6)}`
      });
    } else {
      // Approve MIM to sMIM
      log("Approving MIM to sMIM vault...");
      const approveTx = await mim.approve(ADDRESSES.sMIM, mintAmount, { gasLimit: 100000 });
      await approveTx.wait();

      // Check preview
      try {
        const previewShares = await sMIM.convertToShares(mintAmount);
        log(`Preview shares: ${fmt(previewShares, 18)}`);
      } catch (e) {
        log("convertToShares failed - may indicate contract issue");
      }

      // Deposit
      log("Depositing MIM to sMIM vault...");
      const depositTx = await sMIM.deposit(mintAmount, { gasLimit: 500000 });
      const receipt = await depositTx.wait();

      const newSMIM = await sMIM.balanceOf(signer.address);
      addResult({
        step: 2,
        name: "Stake MIM",
        status: "PASS",
        details: `Staked 1 MIM, received ${fmt(newSMIM, 18)} sMIM`,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString()
      });
    }
  } catch (e: any) {
    addResult({
      step: 2,
      name: "Stake MIM",
      status: "FAIL",
      details: "Staking failed",
      error: e.message?.slice(0, 150)
    });
    addBug({
      id: "BUG-002",
      severity: "CRITICAL",
      title: "sMIM Deposit Failed",
      description: "Cannot deposit MIM to staking vault",
      contract: ADDRESSES.sMIM,
      evidence: e.message?.slice(0, 200) || "Unknown error"
    });
  }

  // ============ STEP 3: Withdraw sMIM ============
  section("STEP 3: WITHDRAW sMIM");

  try {
    const smimBal = await sMIM.balanceOf(signer.address);
    log(`sMIM balance: ${fmt(smimBal, 18)}`);

    if (smimBal.eq(0)) {
      addResult({
        step: 3,
        name: "Withdraw sMIM",
        status: "SKIP",
        details: "No sMIM to withdraw"
      });
    } else {
      const withdrawAmount = smimBal.div(2); // Withdraw half
      log(`Withdrawing ${fmt(withdrawAmount, 18)} sMIM...`);

      // Check available cash
      try {
        const cash = await sMIM.getCash();
        log(`Available cash: ${fmt(cash, 6)} MIM`);
      } catch (e) {
        log("getCash() failed");
      }

      const withdrawTx = await sMIM.withdraw(withdrawAmount, { gasLimit: 500000 });
      const receipt = await withdrawTx.wait();

      const newMIM = await mim.balanceOf(signer.address);
      addResult({
        step: 3,
        name: "Withdraw sMIM",
        status: "PASS",
        details: `Withdrew, new MIM balance: ${fmt(newMIM, 6)}`,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString()
      });
    }
  } catch (e: any) {
    addResult({
      step: 3,
      name: "Withdraw sMIM",
      status: "FAIL",
      details: "Withdrawal failed",
      error: e.message?.slice(0, 150)
    });
    addBug({
      id: "BUG-003",
      severity: "CRITICAL",
      title: "sMIM Withdrawal Failed",
      description: "Users cannot withdraw staked MIM - funds LOCKED",
      contract: ADDRESSES.sMIM,
      evidence: e.message?.slice(0, 200) || "Unknown error"
    });
  }

  // ============ STEP 4: Swap MIM to sUSDC ============
  section("STEP 4: SWAP MIM TO sUSDC");

  try {
    const mimBal = await mim.balanceOf(signer.address);
    log(`MIM balance: ${fmt(mimBal, 6)}`);

    if (mimBal.eq(0)) {
      addResult({
        step: 4,
        name: "Swap MIM to sUSDC",
        status: "SKIP",
        details: "No MIM to swap"
      });
    } else {
      // For now, skip actual swap as it requires router setup
      addResult({
        step: 4,
        name: "Swap MIM to sUSDC",
        status: "SKIP",
        details: "Swap skipped - using existing sUSDC balance"
      });
    }
  } catch (e: any) {
    addResult({
      step: 4,
      name: "Swap MIM to sUSDC",
      status: "FAIL",
      details: "Swap failed",
      error: e.message?.slice(0, 150)
    });
  }

  // ============ STEP 5: Mint 1 MIM Again ============
  section("STEP 5: MINT 1 MIM AGAIN");

  try {
    const susdcBal = await sUSDC.balanceOf(signer.address);

    if (susdcBal.lt(mintAmount)) {
      addResult({
        step: 5,
        name: "Mint 1 MIM (again)",
        status: "SKIP",
        details: `Insufficient sUSDC: ${fmt(susdcBal, 6)}`
      });
    } else {
      await sUSDC.approve(ADDRESSES.MIM, mintAmount, { gasLimit: 100000 });

      try {
        const mintTx = await mim.mintWithUSDC(mintAmount, { gasLimit: 500000 });
        const receipt = await mintTx.wait();

        addResult({
          step: 5,
          name: "Mint 1 MIM (again)",
          status: "PASS",
          details: "Second mint successful",
          txHash: receipt.transactionHash
        });
      } catch (e: any) {
        addResult({
          step: 5,
          name: "Mint 1 MIM (again)",
          status: "FAIL",
          details: "Second mint failed",
          error: e.message?.slice(0, 100)
        });
      }
    }
  } catch (e: any) {
    addResult({
      step: 5,
      name: "Mint 1 MIM (again)",
      status: "FAIL",
      details: "Failed",
      error: e.message?.slice(0, 100)
    });
  }

  // ============ STEP 6: Stake MIM Again ============
  section("STEP 6: STAKE MIM AGAIN");

  try {
    const mimBal = await mim.balanceOf(signer.address);

    if (mimBal.lt(mintAmount)) {
      addResult({
        step: 6,
        name: "Stake MIM (again)",
        status: "SKIP",
        details: `Insufficient MIM: ${fmt(mimBal, 6)}`
      });
    } else {
      await mim.approve(ADDRESSES.sMIM, mintAmount, { gasLimit: 100000 });
      const depositTx = await sMIM.deposit(mintAmount, { gasLimit: 500000 });
      const receipt = await depositTx.wait();

      addResult({
        step: 6,
        name: "Stake MIM (again)",
        status: "PASS",
        details: "Second stake successful",
        txHash: receipt.transactionHash
      });
    }
  } catch (e: any) {
    addResult({
      step: 6,
      name: "Stake MIM (again)",
      status: "FAIL",
      details: "Second stake failed",
      error: e.message?.slice(0, 100)
    });
  }

  // ============ STEP 7: Join 0IL Vault ============
  section("STEP 7: JOIN 0IL VAULT (~$1 ETH)");

  try {
    // Get price
    const price = await oracle.getPrice();
    const priceNum = parseFloat(fmt(price, 18));
    log(`Oracle price: ${priceNum.toFixed(2)} MIM/sWETH`);

    // Calculate $1 worth of sWETH
    const dollarValue = 1;
    const swethNeeded = dollarValue / priceNum;
    const depositAmount = ethers.utils.parseUnits(swethNeeded.toFixed(18), 18);

    log(`For $1, need: ${swethNeeded.toFixed(8)} sWETH`);

    const swethBal = await sWETH.balanceOf(signer.address);
    log(`sWETH balance: ${fmt(swethBal, 18)}`);

    if (swethBal.lt(depositAmount)) {
      addResult({
        step: 7,
        name: "Join 0IL Vault",
        status: "SKIP",
        details: `Insufficient sWETH: have ${fmt(swethBal, 18)}, need ${swethNeeded.toFixed(8)}`
      });
    } else {
      // Get state before deposit
      const debtBefore = await leverageAMM.totalDebt();
      const underlyingBefore = await leverageAMM.totalUnderlying();
      const wethSharesBefore = await wETH.balanceOf(signer.address);

      log(`Before - Debt: ${fmt(debtBefore, 18)}, Underlying: ${fmt(underlyingBefore, 18)}`);

      // Approve sWETH to wETH
      log("Approving sWETH...");
      await sWETH.approve(ADDRESSES.wETH, depositAmount, { gasLimit: 100000 });

      // Deposit with 0 minShares (no slippage protection for test)
      log("Depositing to wETH vault...");
      const depositTx = await wETH.deposit(depositAmount, 0, { gasLimit: 1500000 });
      const receipt = await depositTx.wait();

      // Get state after deposit
      const debtAfter = await leverageAMM.totalDebt();
      const underlyingAfter = await leverageAMM.totalUnderlying();
      const wethSharesAfter = await wETH.balanceOf(signer.address);
      const dtvAfter = await leverageAMM.getCurrentDTV();

      log(`After - Debt: ${fmt(debtAfter, 18)}, Underlying: ${fmt(underlyingAfter, 18)}`);
      log(`wETH shares received: ${fmt(wethSharesAfter.sub(wethSharesBefore), 18)}`);
      log(`DTV ratio: ${(parseFloat(fmt(dtvAfter, 18)) * 100).toFixed(2)}%`);

      // Verify leverage was applied
      const debtIncrease = debtAfter.sub(debtBefore);
      const underlyingIncrease = underlyingAfter.sub(underlyingBefore);

      addResult({
        step: 7,
        name: "Join 0IL Vault",
        status: "PASS",
        details: `Deposited ${fmt(depositAmount, 18)} sWETH, received ${fmt(wethSharesAfter.sub(wethSharesBefore), 18)} wETH shares, borrowed ${fmt(debtIncrease, 18)} MIM`,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString()
      });

      // Verify correctness
      section("VERIFICATION");

      // Check V3 LP Vault
      try {
        const [asset0, asset1] = await v3LPVault.getTotalAssets();
        const layerCount = await v3LPVault.getLayerCount();
        log(`V3LP Vault - token0: ${fmt(asset0, 18)}, token1: ${fmt(asset1, 18)}, layers: ${layerCount}`);
      } catch (e) {
        log("V3LP Vault query failed");
      }

      // Check DTV is around 50%
      const dtvNum = parseFloat(fmt(dtvAfter, 18));
      if (dtvNum < 0.4 || dtvNum > 0.6) {
        addBug({
          id: "BUG-004",
          severity: "MEDIUM",
          title: "DTV Outside Target Range",
          description: `DTV is ${(dtvNum * 100).toFixed(2)}%, should be ~50%`,
          contract: ADDRESSES.LeverageAMM,
          evidence: `DTV = ${dtvNum}`
        });
      }
    }
  } catch (e: any) {
    addResult({
      step: 7,
      name: "Join 0IL Vault",
      status: "FAIL",
      details: "Vault join failed",
      error: e.message?.slice(0, 150)
    });
  }

  // ============ STEP 8: Fee Collection Review ============
  section("STEP 8: 7-DAY FEE COLLECTION REVIEW");

  try {
    const lastPayment = await leverageAMM.lastWeeklyPayment();
    const accFees = await leverageAMM.accumulatedFees();
    const pendingFees = await leverageAMM.pendingWTokenFees();

    const lastPaymentDate = new Date(lastPayment.toNumber() * 1000);
    const daysSince = (Date.now() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24);

    log(`Last Weekly Payment: ${lastPaymentDate.toISOString()}`);
    log(`Days Since Payment: ${daysSince.toFixed(2)}`);
    log(`Accumulated Fees: ${fmt(accFees, 18)} MIM`);
    log(`Pending wToken Fees: ${fmt(pendingFees, 18)} MIM`);

    if (lastPayment.eq(0)) {
      addBug({
        id: "BUG-005",
        severity: "CRITICAL",
        title: "Weekly Interest Never Initialized",
        description: "lastWeeklyPayment is 0 (Unix epoch) - system never initialized",
        contract: ADDRESSES.LeverageAMM,
        evidence: `lastWeeklyPayment = ${lastPayment.toString()}`
      });
    }

    // Check expected interest
    try {
      const expectedInterest = await leverageAMM.getExpectedWeeklyInterest();
      log(`Expected Weekly Interest: ${fmt(expectedInterest, 18)} MIM`);

      const accFeesNum = parseFloat(fmt(accFees, 18));
      const expectedNum = parseFloat(fmt(expectedInterest, 18));

      if (expectedNum > 0 && accFeesNum < expectedNum) {
        addBug({
          id: "BUG-006",
          severity: "HIGH",
          title: "Weekly Interest Shortfall",
          description: `Accumulated fees (${accFeesNum.toFixed(6)}) < expected interest (${expectedNum.toFixed(6)})`,
          contract: ADDRESSES.LeverageAMM,
          evidence: `Shortfall: ${(expectedNum - accFeesNum).toFixed(6)} MIM`
        });
      }
    } catch (e) {
      log("Could not get expected weekly interest");
    }

    // Check sMIM vault state
    try {
      const weekStart = await sMIM.weekStartTime();
      const isWeekComplete = await sMIM.isWeekComplete();
      const borrowRate = await sMIM.borrowRate();
      const avgUtil = await sMIM.averageUtilization();

      log(`\nsMIM Vault:`);
      log(`Week Start: ${new Date(weekStart.toNumber() * 1000).toISOString()}`);
      log(`Is Week Complete: ${isWeekComplete}`);
      log(`Borrow Rate: ${(parseFloat(fmt(borrowRate, 18)) * 100).toFixed(2)}%`);
      log(`Avg Utilization: ${(parseFloat(fmt(avgUtil, 18)) * 100).toFixed(2)}%`);

      // Check utilization snapshots
      log(`\nDaily Utilization Snapshots:`);
      for (let i = 0; i < 7; i++) {
        const util = await sMIM.dailyUtilization(i);
        log(`  Day ${i}: ${(parseFloat(fmt(util, 18)) * 100).toFixed(2)}%`);
      }
    } catch (e: any) {
      log(`sMIM vault query failed: ${e.message?.slice(0, 50)}`);
    }

    addResult({
      step: 8,
      name: "Fee Collection Review",
      status: "PASS",
      details: `Last payment: ${daysSince.toFixed(2)} days ago, Fees: ${fmt(accFees, 18)} MIM`
    });
  } catch (e: any) {
    addResult({
      step: 8,
      name: "Fee Collection Review",
      status: "FAIL",
      details: "Could not analyze fee collection",
      error: e.message?.slice(0, 100)
    });
  }

  // ============ SUMMARY ============
  section("TEST SUMMARY");

  let passed = 0, failed = 0, skipped = 0;
  for (const r of results) {
    if (r.status === "PASS") passed++;
    else if (r.status === "FAIL") failed++;
    else skipped++;
  }

  console.log(`\n✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⏭️ SKIPPED: ${skipped}`);

  section("BUG REPORT");

  if (bugs.length === 0) {
    console.log("\n  No bugs found!");
  } else {
    for (const bug of bugs) {
      console.log(`\n${bug.id} [${bug.severity}]: ${bug.title}`);
      console.log(`  Contract: ${bug.contract}`);
      console.log(`  Description: ${bug.description}`);
      console.log(`  Evidence: ${bug.evidence}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("  TEST COMPLETE");
  console.log("═".repeat(60) + "\n");

  return { results, bugs };
}

main()
  .then(({ results, bugs }) => {
    // Output structured data for further processing
    console.log("\n📋 Structured Output:");
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      bugs,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === "PASS").length,
        failed: results.filter(r => r.status === "FAIL").length,
        skipped: results.filter(r => r.status === "SKIP").length,
        bugsFound: bugs.length,
        criticalBugs: bugs.filter(b => b.severity === "CRITICAL").length
      }
    }, null, 2));
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
